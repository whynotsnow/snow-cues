import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigrationBatch, createMigrationEntry, createSpaceRelation, createPasswordEntry, getSpace, listPasswordEntriesBySpace, listSpaceProfile, saveSpace, saveSpaceProfile } from "../../storage-engine/storage-engine";
import { createSession } from "../../session-manager/session-manager";
import { decryptPassword, deriveRuntimeStorageKey, generatePasswordWithRuleChain } from "../../crypto-engine/crypto-engine";
import { confirmRuleProfileWithMaster, encryptPasswordForEntrySecret, enterSpace, establishSpaceSession, expectNoPageNotice, expectPageNotice, fillFirstSpaceMasterPassword, getGuidancePanel, getSourceVerificationPanel, mockBrowserNotification, renderApp, resetAppTestEnvironment, seedEncryptedPasswordEntry } from "../../test/appTestHelpers";
import { getUserGuidance } from "../guidance";

beforeEach(resetAppTestEnvironment);

describe("迁移 UI 流程", () => {
  it("空间主页按详情、迁移情况、当前空间操作展示", async () => {
    await saveSpace({
      spaceId: "target",
      status: "active"
    });
    await saveSpace({
      spaceId: "source",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "target",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    const batch = await createMigrationBatch({
      sourceSpaceId: "source",
      targetSpaceId: "target",
      sourceType: "clone",
      status: "draft",
      sourceProfileSnapshot: {
        ruleChain: ["v1-hmac"],
        importedRuleManifests: []
      },
      totalCount: 1
    });
    await createMigrationEntry({
      batchId: batch.id,
      sourceSpaceId: "source",
      targetSpaceId: "target",
      sourceEntryId: "source-entry",
      sourceEncryptedPassword: "sealed"
    });

    renderApp();

    await enterSpace("target");

    await waitFor(() => expect(screen.getByText("迁移未完成 / 已迁移 0 条 / 剩余 1 条")).toBeInTheDocument());
    await waitFor(() =>
      expect(within(getGuidancePanel()).getByRole("heading", { name: "继续迁移前先设置目标空间主密码" })).toBeInTheDocument()
    );
    expect(within(getGuidancePanel()).getByText("目标空间主密码尚未设置，迁移写入前需要先建立本次空间会话。")).toBeInTheDocument();
    expect(screen.queryByText("操作失败")).not.toBeInTheDocument();
    expect(screen.queryByText("请输入目标空间主密码。")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "空间主页" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "规则管理" }).compareDocumentPosition(screen.getByRole("button", { name: "密码管理" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "迁移情况" }).compareDocumentPosition(screen.getByRole("heading", { name: "当前空间操作" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "空间列表" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "当前空间操作" })).toBeInTheDocument();
    expect(screen.getByLabelText("操作方式")).toBeInTheDocument();
    expect(screen.queryByLabelText("目标存储空间 ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("新空间主密码")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("操作方式"), {
      target: { value: "clone_current_profile" }
    });
    expect(screen.getByLabelText("目标存储空间 ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("新空间主密码")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("操作方式"), {
      target: { value: "export_profile" }
    });
    expect(screen.queryByLabelText("目标存储空间 ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("新空间主密码")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成导出 JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行迁移" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "跳过" })).toBeInTheDocument();
  });

  it("来源空间校验后可以用目标空间主密码执行迁移", async () => {
    await saveSpace({
      spaceId: "target-migrate",
      status: "active"
    });
    await saveSpace({
      spaceId: "source-migrate",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "target-migrate",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    const batch = await createMigrationBatch({
      sourceSpaceId: "source-migrate",
      targetSpaceId: "target-migrate",
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
      sourceSpaceId: "source-migrate",
      targetSpaceId: "target-migrate",
      sourceEntryId: "source-entry",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("old-secret"),
      platform: "Example"
    });

    renderApp();

    await enterSpace("target-migrate");
    await screen.findByRole("heading", { name: "迁移情况" });
    expect(screen.getByRole("heading", { name: "设置空间主密码" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "执行迁移" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(screen.getByRole("button", { name: "建立空间会话" }));
    await waitFor(() => expect(screen.getByText("空间主密码已设置，本次空间会话已建立。")).toBeInTheDocument());

    const sourceVerificationPanel = getSourceVerificationPanel();
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧关键密钥"), {
      target: { value: "old-secret" }
    });
    fireEvent.click(screen.getByLabelText("复用旧关键密钥作为新关键密钥"));
    fireEvent.change(screen.getByLabelText("旧空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(screen.getByRole("button", { name: "校验来源空间" }));
    await waitFor(() => expect(screen.getByText("来源空间已校验，后续迁移只需为每条密码填写对应旧关键密钥。")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "执行迁移" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "执行迁移" }));
    await waitFor(() => expect(screen.getByText("已保持平台密码不变并完成迁移。")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("heading", { name: "迁移情况" })).not.toBeInTheDocument());
    expect(within(getGuidancePanel()).queryByRole("heading", { name: "逐条处理迁移密码" })).not.toBeInTheDocument();
    await expect(listPasswordEntriesBySpace("target-migrate")).resolves.toHaveLength(1);
  });

  it("已有接替关系时不再生成迁移指引", () => {
    const guidance = getUserGuidance({
      activePage: "space",
      currentSpaceId: "target-finalized-relation",
      currentSpaceStatus: "active",
      entries: [],
      migrationBatches: [
        {
          id: "batch-finalized-relation",
          sourceSpaceId: "source-finalized-relation",
          targetSpaceId: "target-finalized-relation",
          sourceType: "clone",
          status: "ready",
          sourceProfileSnapshot: {
            ruleChain: ["v1-hmac"],
            importedRuleManifests: []
          },
          totalCount: 1,
          migratedCount: 0,
          autoFinalizeSource: true,
          createdAt: 1,
          updatedAt: 1
        }
      ],
      migrationEntries: [
        {
          id: "migration-entry",
          batchId: "batch-finalized-relation",
          sourceSpaceId: "source-finalized-relation",
          targetSpaceId: "target-finalized-relation",
          sourceEntryId: "source-entry",
          sourceEncryptedPassword: "sealed",
          status: "pending",
          createdAt: 1,
          updatedAt: 1
        }
      ],
      outsideSpace: false,
      pendingDetachedEntrySecret: "",
      ruleProfileConfirmed: true,
      selectedMigrationBatch: {
        id: "batch-finalized-relation",
        sourceSpaceId: "source-finalized-relation",
        targetSpaceId: "target-finalized-relation",
        sourceType: "clone",
        status: "ready",
        sourceProfileSnapshot: {
          ruleChain: ["v1-hmac"],
          importedRuleManifests: []
        },
        totalCount: 1,
        migratedCount: 0,
        autoFinalizeSource: true,
        createdAt: 1,
        updatedAt: 1
      },
      sessionAlive: false,
      sourceSessionVerified: false,
      spaceIndexItems: [],
      spaceRelations: [
        {
          id: "relation-finalized",
          fromSpaceId: "target-finalized-relation",
          toSpaceId: "source-finalized-relation",
          type: "successor_of",
          createdAt: 1
        }
      ],
      verificationPending: false
    });

    expect(guidance.cards.map((card) => card.title)).toEqual(["设置本次空间主密码"]);
  });

  it("来源空间校验失败时在卡片和系统通知展示原因", async () => {
    await saveSpace({
      spaceId: "target-source-error",
      status: "active"
    });
    await saveSpace({
      spaceId: "source-source-error",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "target-source-error",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    const batch = await createMigrationBatch({
      sourceSpaceId: "source-source-error",
      targetSpaceId: "target-source-error",
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
      sourceSpaceId: "source-source-error",
      targetSpaceId: "target-source-error",
      sourceEntryId: "source-entry",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("old-secret"),
      platform: "Example"
    });

    renderApp();

    await enterSpace("target-source-error");
    await screen.findByRole("heading", { name: "迁移情况" });
    await screen.findByRole("heading", { name: "来源空间校验" });
    const sourceVerificationPanel = getSourceVerificationPanel();
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧关键密钥"), {
      target: { value: "old-secret" }
    });
    fireEvent.click(within(sourceVerificationPanel).getByRole("button", { name: "校验来源空间" }));

    await waitFor(() => expect(within(sourceVerificationPanel).getByText("请输入旧空间主密码。")).toBeInTheDocument());
    expect(screen.getByLabelText("系统通知")).toHaveTextContent("来源空间校验失败");
    expect(screen.getByLabelText("系统通知")).toHaveTextContent("请输入旧空间主密码。");
  });

  it("来源空间校验可以改选任意待迁移密码条目", async () => {
    await saveSpace({
      spaceId: "target-select-source",
      status: "active"
    });
    await saveSpace({
      spaceId: "source-select-source",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "target-select-source",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    const batch = await createMigrationBatch({
      sourceSpaceId: "source-select-source",
      targetSpaceId: "target-select-source",
      sourceType: "clone",
      status: "ready",
      sourceProfileSnapshot: {
        ruleChain: ["v1-hmac"],
        importedRuleManifests: []
      },
      totalCount: 2
    });
    await createMigrationEntry({
      batchId: batch.id,
      sourceSpaceId: "source-select-source",
      targetSpaceId: "target-select-source",
      sourceEntryId: "source-entry-first",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("first-secret"),
      platform: "First"
    });
    const secondMigrationEntry = await createMigrationEntry({
      batchId: batch.id,
      sourceSpaceId: "source-select-source",
      targetSpaceId: "target-select-source",
      sourceEntryId: "source-entry-second",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("second-secret"),
      platform: "Second"
    });

    renderApp();

    await enterSpace("target-select-source");
    fireEvent.change(screen.getByLabelText("空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(screen.getByRole("button", { name: "建立空间会话" }));
    await waitFor(() => expect(screen.getByText("空间主密码已设置，本次空间会话已建立。")).toBeInTheDocument());

    const sourceVerificationPanel = getSourceVerificationPanel();
    const verificationEntrySelect = within(sourceVerificationPanel).getByLabelText("用于校验的旧密码条目");
    fireEvent.change(verificationEntrySelect, {
      target: { value: secondMigrationEntry.id }
    });
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧关键密钥"), {
      target: { value: "second-secret" }
    });
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(within(sourceVerificationPanel).getByRole("button", { name: "校验来源空间" }));

    await waitFor(() => expect(screen.getByText("来源空间已校验，后续迁移只需为每条密码填写对应旧关键密钥。")).toBeInTheDocument());
    await waitFor(() => expect(within(sourceVerificationPanel).getByText("来源空间已完成校验。本次会话内迁移条目时，只需要为每条密码填写对应的旧关键密钥。")).toBeInTheDocument());
    expect(within(sourceVerificationPanel).queryByRole("button", { name: "校验来源空间" })).not.toBeInTheDocument();
    expect(within(sourceVerificationPanel).queryByLabelText("旧空间主密码")).not.toBeInTheDocument();
  });

  it("clone 密码条目进入目标空间后先以来源规则草稿初始化再迁移", async () => {
    await saveSpace({
      spaceId: "source-clone-draft",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "source-clone-draft",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    await createPasswordEntry({
      spaceId: "source-clone-draft",
      encrypted_password: await encryptPasswordForEntrySecret("old-secret"),
      platform: "Example"
    });

    renderApp();

    await screen.findByText("source-clone-draft");
    fireEvent.click(screen.getByRole("button", { name: "新建空间" }));
    fireEvent.change(screen.getByLabelText("创建方式"), {
      target: { value: "clone_with_entries" }
    });
    fireEvent.change(screen.getByLabelText("目标存储空间 ID"), {
      target: { value: "target-clone-draft" }
    });
    fireEvent.change(screen.getByLabelText("来源存储空间"), {
      target: { value: "source-clone-draft" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建并进入空间" }));

    await waitFor(() => expect(screen.getByText("已创建目标空间和密码迁移队列，并进入目标空间主页。请先在空间主页设置空间主密码后继续。")).toBeInTheDocument());
    await waitFor(() =>
      expect(within(getGuidancePanel()).getByRole("heading", { name: "继续迁移前先设置目标空间主密码" })).toBeInTheDocument()
    );
    await expect(listSpaceProfile("target-clone-draft")).resolves.toBeNull();
    expect(screen.queryByRole("button", { name: "目标规则已初始化，开始迁移" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(screen.getByRole("button", { name: "建立空间会话" }));
    await waitFor(() => expect(screen.getByText("空间主密码已设置，本次空间会话已建立。")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    expect(within(getGuidancePanel()).getByRole("heading", { name: "先初始化目标规则链" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("待初始化规则链")).toBeInTheDocument());
    expect(screen.getAllByText("稳定 HMAC").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "确认初始化" }));
    await waitFor(async () => {
      await expect(listSpaceProfile("target-clone-draft")).resolves.toMatchObject({
        ruleChain: ["v1-hmac"]
      });
    });
    await waitFor(() => expect(screen.getByText("目标规则链已初始化，迁移批次已自动就绪。")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "空间主页" }));
    await waitFor(() =>
      expect(within(getGuidancePanel()).getByRole("heading", { name: "校验来源空间" })).toBeInTheDocument()
    );
    const autoFinalizeCheckbox = screen.getByRole("checkbox", { name: /迁移完成后自动流转来源空间状态/ });
    expect(autoFinalizeCheckbox).toBeChecked();
    fireEvent.click(autoFinalizeCheckbox);
    await waitFor(() => expect(screen.getByText("已改为手动流转来源空间状态。")).toBeInTheDocument());
    const sourceVerificationPanel = getSourceVerificationPanel();
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧关键密钥"), {
      target: { value: "old-secret" }
    });
    fireEvent.change(within(sourceVerificationPanel).getByLabelText("旧空间主密码"), {
      target: { value: "master" }
    });
    fireEvent.click(within(sourceVerificationPanel).getByRole("button", { name: "校验来源空间" }));
    await waitFor(() => expect(screen.getByText("来源空间已校验，后续迁移只需为每条密码填写对应旧关键密钥。")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("复用旧关键密钥作为新关键密钥"));
    expect(screen.getByRole("button", { name: "执行迁移" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "执行迁移" }));
    await waitFor(() => expect(screen.getByText("已保持平台密码不变并完成迁移。")).toBeInTheDocument());
    await expect(listPasswordEntriesBySpace("target-clone-draft")).resolves.toHaveLength(1);
    await expect(getSpace("source-clone-draft")).resolves.toMatchObject({ status: "active" });
    expect(screen.queryByText("Example")).not.toBeInTheDocument();
    expect(screen.getByText("迁移条目已全部处理完成。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手动流转来源空间状态" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "手动流转来源空间状态" }));
    await waitFor(() => expect(screen.getByText("来源空间状态已手动流转为历史空间，并已记录接替关系。")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "来源空间状态已流转" })).toBeDisabled();
    expect(within(getGuidancePanel()).queryByRole("heading", { name: "手动流转来源空间状态" })).not.toBeInTheDocument();
    expect(within(getGuidancePanel()).queryByRole("heading", { name: "逐条处理迁移密码" })).not.toBeInTheDocument();
    await expect(getSpace("source-clone-draft")).resolves.toMatchObject({ status: "deprecated" });
  });
});
