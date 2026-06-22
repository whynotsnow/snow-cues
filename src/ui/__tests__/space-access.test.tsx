import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigrationBatch, createMigrationEntry, createSpaceRelation, createPasswordEntry, getSpace, listPasswordEntriesBySpace, listSpaceProfile, saveSpace, saveSpaceProfile } from "../../storage-engine/storage-engine";
import { createSession } from "../../session-manager/session-manager";
import { decryptPassword, deriveRuntimeStorageKey, generatePasswordWithRuleChain } from "../../crypto-engine/crypto-engine";
import { confirmRuleProfileWithMaster, encryptPasswordForEntrySecret, enterSpace, establishSpaceSession, expectNoPageNotice, expectPageNotice, fillFirstSpaceMasterPassword, getGuidancePanel, getSourceVerificationPanel, mockBrowserNotification, renderApp, resetAppTestEnvironment, seedEncryptedPasswordEntry } from "../../test/appTestHelpers";

beforeEach(resetAppTestEnvironment);

describe("空间进入与门禁", () => {
  it("进入空间后可以用已存储密码和关键密钥进行校验", async () => {
    renderApp();

    await enterSpace();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(within(getGuidancePanel()).getByRole("heading", { name: "设置本次空间主密码" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "先初始化规则链" }));
    await screen.findByRole("button", { name: "确认初始化" });
    await confirmRuleProfileWithMaster();

    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Example" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() => expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "离开空间" }));
    await enterSpace();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expectPageNotice("需要先完成空间校验");
    expect(within(getGuidancePanel()).getByRole("heading", { name: "先完成空间校验" })).toBeInTheDocument();
    expect(within(getGuidancePanel()).getByText(/能解密既有密码，就代表本次空间主密码校验成功/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往空间主页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "校验后可新建" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "校验空间" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "前往空间主页" }));
    await screen.findByRole("heading", { name: "空间校验" });
    expect(screen.getByLabelText("解密关键密钥")).toBeInTheDocument();

    await fillFirstSpaceMasterPassword();
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "wrong-salt" }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成空间校验" }));
    await waitFor(() => expect(screen.getByText("解密失败，请检查关键密钥。")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成空间校验" }));
    await waitFor(() => expect(screen.getByText("空间校验已完成。")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(screen.getByRole("button", { name: "新建密码" })).toBeInTheDocument();
  });

  it("空间主页允许改选用于校验的密码条目", async () => {
    await saveSpace({
      spaceId: "selectable",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "selectable",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    await seedEncryptedPasswordEntry("selectable", "entry-first", "First", "first-secret");
    await seedEncryptedPasswordEntry("selectable", "entry-second", "Second", "second-secret");
    renderApp();

    await enterSpace("selectable");
    await screen.findByRole("heading", { name: "空间校验" });
    expect(screen.getByLabelText("解密关键密钥")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("用于校验的密码条目"), {
      target: { value: "entry-first" }
    });
    expect(screen.getByLabelText("用于校验的密码条目")).toHaveValue("entry-first");
    await fillFirstSpaceMasterPassword();
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "first-secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成空间校验" }));

    await waitFor(() => expect(screen.getByText("空间校验已完成。")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(screen.queryByText("需要先完成空间校验")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建密码" })).not.toBeDisabled();
  });

  it("空间校验未完成时优先展示校验指引并阻塞迁移指引", async () => {
    await saveSpace({
      spaceId: "verify-before-migration",
      status: "active"
    });
    await saveSpace({
      spaceId: "source-before-verification",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "verify-before-migration",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    await seedEncryptedPasswordEntry("verify-before-migration", "existing-entry", "Existing", "entry-secret");
    const batch = await createMigrationBatch({
      sourceSpaceId: "source-before-verification",
      targetSpaceId: "verify-before-migration",
      sourceType: "clone",
      status: "ready",
      sourceProfileSnapshot: {
        ruleChain: ["v1-hmac"],
        importedRuleManifests: []
      },
      totalCount: 1
    });
    await createMigrationEntry({
      batchId: batch.id,
      sourceSpaceId: "source-before-verification",
      targetSpaceId: "verify-before-migration",
      sourceEntryId: "source-entry",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("old-secret")
    });

    renderApp();

    await enterSpace("verify-before-migration");

    await waitFor(() => expect(within(getGuidancePanel()).getByRole("heading", { name: "迁移流程待继续" })).toBeInTheDocument());
    const guidancePanel = getGuidancePanel();
    const headings = within(guidancePanel).getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.at(0)).toBe("先完成空间校验");
    expect(within(guidancePanel).getByText("当前空间校验未完成，完成校验后才能继续迁移。")).toBeInTheDocument();
  });

  it("已有密码的空间进入后必须先完成校验才能写入或修改", async () => {
    renderApp();

    await enterSpace();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));

    fireEvent.click(screen.getByRole("button", { name: "先初始化规则链" }));
    await screen.findByRole("button", { name: "确认初始化" });
    await confirmRuleProfileWithMaster();

    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Example" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() => expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "离开空间" }));
    await enterSpace();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expectPageNotice("需要先完成空间校验");
    expect(screen.getByRole("button", { name: "前往空间主页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "校验后可新建" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "校验空间" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑条目" })).toBeDisabled();
    expect(screen.getByText("请先输入空间主密码并完成空间校验。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "废弃" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "已初始化" })).toBeDisabled());
    expect(screen.getByLabelText("导入声明式规则或规则数组")).toBeDisabled();
    expect(screen.getByRole("button", { name: "导入规则" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    fireEvent.click(screen.getByRole("button", { name: "前往空间主页" }));
    await screen.findByRole("heading", { name: "空间校验" });

    await fillFirstSpaceMasterPassword();
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成空间校验" }));
    await waitFor(() => expect(screen.getByText("空间校验已完成。")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(screen.getByRole("button", { name: "新建密码" })).not.toBeDisabled();
  });

  it("deprecated Space 禁止创建密码和修改规则，但保留历史查看入口", async () => {
    await saveSpace({
      spaceId: "history",
      status: "deprecated"
    });
    await saveSpaceProfile({
      spaceId: "history",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    renderApp();

    await enterSpace("history");
    await screen.findByText("状态：历史", undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expectPageNotice("历史存储空间");
    const historyPageNotice = within(screen.getByLabelText("当前页面")).getByLabelText("页面通知");
    expect(within(historyPageNotice).getByText(/通常表示已有后继空间接替/)).toBeInTheDocument();
    expect(within(historyPageNotice).getByText(/创建、编辑、废弃、规则变更和迁移管理均不可用/)).toBeInTheDocument();
    expect(within(historyPageNotice).queryByText(/clone/)).not.toBeInTheDocument();
    expect(within(getGuidancePanel()).getByText("可用操作")).toBeInTheDocument();
    expect(within(getGuidancePanel()).getByRole("heading", { name: "历史空间可用操作" })).toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByText("进入历史空间")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建不可用" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    expectPageNotice("历史存储空间");
    expect(screen.getByRole("button", { name: "已初始化" })).toBeDisabled();
    expect(screen.getByLabelText("导入声明式规则或规则数组")).toBeDisabled();
    expect(screen.getByRole("button", { name: "导入规则" })).toBeDisabled();
  });

  it("历史空间有条目时显示解密准备指引而不是 active 空间校验指引", async () => {
    await saveSpace({
      spaceId: "history-with-entry",
      status: "deprecated"
    });
    await saveSpaceProfile({
      spaceId: "history-with-entry",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    await seedEncryptedPasswordEntry("history-with-entry", "history-entry", "History", "history-secret");

    renderApp();

    await enterSpace("history-with-entry");
    expectPageNotice("历史存储空间");
    expect(within(getGuidancePanel()).getByRole("heading", { name: "准备解密历史密码" })).toBeInTheDocument();
    expect(within(getGuidancePanel()).getByText(/查看历史列表不需要校验/)).toBeInTheDocument();
    expect(within(getGuidancePanel()).getByText(/历史密码校验区域输入空间主密码/)).toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByText(/设置本次空间主密码/)).not.toBeInTheDocument();
    expect(within(getGuidancePanel()).getByRole("button", { name: "前往历史密码校验" })).toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByRole("heading", { name: "先完成空间校验" })).not.toBeInTheDocument();

    await fillFirstSpaceMasterPassword();
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "history-secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成空间校验" }));

    await waitFor(() => expect(screen.getByText("空间校验已完成。")).toBeInTheDocument());
    expect(within(getGuidancePanel()).getByText(/本次会话已完成历史密码解密准备/)).toBeInTheDocument();
  });

  it("archived Space 禁止创建、编辑、废弃、规则管理和日常派生", async () => {
    await saveSpace({
      spaceId: "archive",
      status: "archived"
    });
    renderApp();

    await enterSpace("archive");
    await screen.findByText("状态：归档", undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expectPageNotice("归档存储空间");
    expect(within(getGuidancePanel()).getByText("受阻流程")).toBeInTheDocument();
    expect(within(getGuidancePanel()).getByRole("heading", { name: "归档空间可用操作" })).toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByRole("heading", { name: "准备解密历史密码" })).not.toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByText("进入归档空间")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建不可用" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    expectPageNotice("归档存储空间");
    expect(screen.getByRole("button", { name: "确认初始化" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "开发测试数据工具" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "测试：清空全部本地数据" })).not.toBeDisabled();
  });
});
