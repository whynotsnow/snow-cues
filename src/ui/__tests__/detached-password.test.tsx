import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createMigrationBatch,
  createMigrationEntry,
  createSpaceRelation,
  createPasswordEntry,
  getSpace,
  listPasswordEntriesBySpace,
  listSpaceProfile,
  saveSpace,
  saveSpaceProfile
} from "../../storage-data";
import { createSession } from "../../session-manager/session-manager";
import {
  decryptPassword,
  deriveRuntimeStorageKey,
  encryptPassword,
  generatePasswordWithRuleChain
} from "../../crypto-engine/crypto-engine";
import {
  confirmRuleProfileWithMaster,
  encryptPasswordForEntrySecret,
  ensureStorageDataOpened,
  enterSpace,
  establishSpaceSession,
  expectNoPageNotice,
  expectPageNotice,
  fillFirstSpaceMasterPassword,
  getGuidancePanel,
  getSourceVerificationPanel,
  mockBrowserNotification,
  renderApp,
  resetAppTestEnvironment,
  seedEncryptedPasswordEntry
} from "../../test/appTestHelpers";

beforeEach(resetAppTestEnvironment);

describe("游离密码流程", () => {
  it("空间外生成游离密码只保存在内存中", async () => {
    renderApp();

    await screen.findByRole("heading", { name: "存储数据" });
    expect(
      screen.queryByRole("heading", { name: "游离密码" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "游离密码" }));
    await screen.findByRole("heading", { name: "游离密码" });
    expect(
      within(getGuidancePanel()).getByRole("heading", {
        name: "生成临时游离密码"
      })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("派生密钥"), {
      target: { value: "temporary-key" }
    });
    fireEvent.change(screen.getByLabelText("输出策略预设"), {
      target: { value: "pin" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成游离密码" }));

    await waitFor(() =>
      expect(screen.getByText("策略处理预览")).toBeInTheDocument()
    );
    expect(
      screen.getByLabelText("游离密码").querySelector(".detached-result code")
        ?.textContent
    ).toMatch(/^\d{6}$/);
    expect(
      screen.getByRole("button", { name: "迁移到空间" })
    ).toBeInTheDocument();
    await expect(listPasswordEntriesBySpace("default")).resolves.toHaveLength(
      0
    );

    fireEvent.click(screen.getByRole("button", { name: "隐藏" }));
    expect(screen.getByText("••••••••••••••••••••••••")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "不迁移并清空" }));
    await waitFor(() =>
      expect(screen.queryByText("策略处理预览")).not.toBeInTheDocument()
    );
  });

  it("游离密码可以迁入已初始化空间并保存为正式密码", async () => {
    await saveSpace({
      spaceId: "vault",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "vault",
      ruleChain: ["v1-hmac", "v2-pbkdf2"],
      importedRuleManifests: []
    });

    renderApp();

    await ensureStorageDataOpened();
    fireEvent.click(screen.getByRole("button", { name: "游离密码" }));
    await screen.findByRole("heading", { name: "游离密码" });
    fireEvent.change(screen.getByLabelText("派生密钥"), {
      target: { value: "temporary-key" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成游离密码" }));
    await waitFor(() =>
      expect(screen.getByText("策略处理预览")).toBeInTheDocument()
    );
    const detachedPreview =
      screen.getByLabelText("游离密码").querySelector(".detached-result code")
        ?.textContent ?? "";
    expect(detachedPreview).toHaveLength(16);
    fireEvent.click(screen.getByRole("button", { name: "迁移到空间" }));
    expect(
      within(getGuidancePanel()).getByRole("heading", {
        name: "迁移游离密码草稿"
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "空间工作台" }));
    await ensureStorageDataOpened();
    await enterSpace("vault");
    await establishSpaceSession();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    await screen.findByRole("heading", { name: "待迁入派生密钥" });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "正式平台" }
    });
    fireEvent.change(screen.getByLabelText("普通备注，可选"), {
      target: { value: "从游离密码迁入" }
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "保存为正式密码" }).at(-1)!
    );

    await waitFor(() =>
      expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument()
    );
    const entries = await listPasswordEntriesBySpace("vault");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      platform: "正式平台",
      description: "从游离密码迁入"
    });
    expect(entries[0]).not.toHaveProperty("ruleId");
    expect(entries[0]).not.toHaveProperty("entrySecret");
    expect(entries[0]).not.toHaveProperty("runtime_salt");

    const session = await createSession("master");
    const runtimeKey = await deriveRuntimeStorageKey(
      session.cryptoKey,
      "temporary-key"
    );
    const expected = await generatePasswordWithRuleChain(
      session.cryptoKey,
      "temporary-key",
      ["v1-hmac", "v2-pbkdf2"],
      {
        mode: "base62",
        maxLength: 24
      }
    );
    await expect(
      decryptPassword(runtimeKey, entries[0].encrypted_password)
    ).resolves.toBe(expected.encodedPassword);
  });

  it("待迁入游离密码遵守规则初始化和空间校验门禁", async () => {
    const session = await createSession("master");
    const runtimeKey = await deriveRuntimeStorageKey(
      session.cryptoKey,
      "old-secret"
    );
    await saveSpace({
      spaceId: "locked-space",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "locked-space",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    await createPasswordEntry({
      spaceId: "locked-space",
      encrypted_password: await encryptPassword(
        runtimeKey,
        "existing-password"
      ),
      platform: "已有平台"
    });

    renderApp();

    await ensureStorageDataOpened();
    fireEvent.click(screen.getByRole("button", { name: "游离密码" }));
    await screen.findByRole("heading", { name: "游离密码" });
    fireEvent.change(screen.getByLabelText("派生密钥"), {
      target: { value: "temporary-key" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成游离密码" }));
    await waitFor(() =>
      expect(screen.getByText("策略处理预览")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "迁移到空间" }));

    fireEvent.click(screen.getByRole("button", { name: "空间工作台" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    await enterSpace("blank-target");
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(
      screen.getByText("请先在规则管理页初始化当前空间规则链。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起保存表单" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "离开空间" }));
    await screen.findByRole("heading", { name: "本地空间索引" });

    await enterSpace("locked-space");
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(
      screen.getByText("当前空间已有密码，请先完成空间校验后再保存游离密码。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起保存表单" })).toBeDisabled();
  });
});
