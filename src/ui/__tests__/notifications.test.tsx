import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigrationBatch, createMigrationEntry, createSpaceRelation, createPasswordEntry, getSpace, listPasswordEntriesBySpace, listSpaceProfile, saveSpace, saveSpaceProfile } from "../../storage-engine/storage-engine";
import { createSession } from "../../session-manager/session-manager";
import { decryptPassword, deriveRuntimeStorageKey, generatePasswordWithRuleChain } from "../../crypto-engine/crypto-engine";
import { confirmRuleProfileWithMaster, encryptPasswordForEntrySecret, enterSpace, establishSpaceSession, expectNoPageNotice, expectPageNotice, fillFirstSpaceMasterPassword, getGuidancePanel, getSourceVerificationPanel, mockBrowserNotification, renderApp, resetAppTestEnvironment, seedEncryptedPasswordEntry } from "../../test/appTestHelpers";

beforeEach(resetAppTestEnvironment);

describe("通知与操作反馈", () => {
  it("系统通知不会在启动时请求浏览器权限，测试工具只显示普通反馈", async () => {
    const { notificationSpy, requestPermissionSpy } = mockBrowserNotification("default");
    renderApp();

    expect(requestPermissionSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "测试：清空全部本地数据" }));

    await waitFor(() => expect(screen.getByText("测试操作已清空全部本地数据。")).toBeInTheDocument());
    expect(notificationSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("系统通知")).not.toBeInTheDocument();
  });

  it("系统级通知在浏览器授权后优先使用浏览器通知", async () => {
    const { notificationSpy } = mockBrowserNotification("granted");
    await saveSpace({
      spaceId: "browser-notice-target",
      status: "active"
    });
    await saveSpace({
      spaceId: "browser-notice-source",
      status: "active"
    });
    await saveSpaceProfile({
      spaceId: "browser-notice-target",
      ruleChain: ["v1-hmac"],
      importedRuleManifests: []
    });
    const batch = await createMigrationBatch({
      sourceSpaceId: "browser-notice-source",
      targetSpaceId: "browser-notice-target",
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
      sourceSpaceId: "browser-notice-source",
      targetSpaceId: "browser-notice-target",
      sourceEntryId: "source-entry",
      sourceEncryptedPassword: await encryptPasswordForEntrySecret("old-secret")
    });

    renderApp();

    await enterSpace("browser-notice-target");
    await screen.findByRole("heading", { name: "来源空间校验" });
    fireEvent.click(screen.getByRole("button", { name: "校验来源空间" }));

    await waitFor(() =>
      expect(notificationSpy).toHaveBeenCalledWith("来源空间校验失败", {
        body: "请输入旧空间主密码。"
      })
    );
    expect(screen.queryByLabelText("系统通知")).not.toBeInTheDocument();
  });

  it("测试数据操作不会降级为站内系统通知", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "测试：清空全部本地数据" }));

    await waitFor(() => expect(screen.getByText("测试操作已清空全部本地数据。")).toBeInTheDocument());
    expect(screen.queryByLabelText("系统通知")).not.toBeInTheDocument();
  });
});
