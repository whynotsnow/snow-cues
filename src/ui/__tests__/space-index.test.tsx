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
} from "../../storage-engine/storage-engine";
import { createSession } from "../../session-manager/session-manager";
import {
  decryptPassword,
  deriveRuntimeStorageKey,
  generatePasswordWithRuleChain
} from "../../crypto-engine/crypto-engine";
import {
  buildNextStorageDataFile,
  createInitialStorageDataFile,
  serializeStorageDataFile
} from "../../storage-data";
import {
  confirmRuleProfileWithMaster,
  encryptPasswordForEntrySecret,
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

describe("空间外索引与创建入口", () => {
  it("空间外展示本地空间索引和创建空间入口", async () => {
    await saveSpace({
      spaceId: "source",
      status: "active"
    });
    await saveSpace({
      spaceId: "target",
      status: "deprecated"
    });
    await createSpaceRelation({
      fromSpaceId: "target",
      toSpaceId: "source",
      type: "successor_of"
    });

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "新建存储数据文件夹" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    expect(await screen.findByText("source")).toBeInTheDocument();
    expect(screen.getByText("target")).toBeInTheDocument();
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByText("历史")).toBeInTheDocument();
    expect(screen.getAllByText("target → source · 接替自")).toHaveLength(2);
    expect(screen.getAllByText("空间数据更新时间")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "新建空间" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "导出当前空间完整备份 JSON" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "已存储密码" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "开发测试数据工具" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "测试：删除指定空间" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "测试：清空全部本地数据" })
    ).toBeInTheDocument();
  });

  it("打开 current.json 后刷新本地空间索引", async () => {
    const emptyFile = await createInitialStorageDataFile(
      "storage_data_imported"
    );
    const importedFile = await buildNextStorageDataFile(emptyFile, {
      ...emptyFile.data,
      spaces: [
        {
          spaceId: "imported-space",
          status: "active",
          createdAt: 1,
          updatedAt: 2
        }
      ]
    });

    renderApp();

    const currentJsonInput = screen.getByLabelText(
      "打开 current.json（下载新版模式）"
    );
    const importedFileText = serializeStorageDataFile(importedFile);
    const uploadedFile = new File([importedFileText], "current.json", {
      type: "application/json"
    });
    Object.defineProperty(uploadedFile, "text", {
      value: async () => importedFileText
    });
    fireEvent.change(currentJsonInput, {
      target: {
        files: [uploadedFile]
      }
    });

    await screen.findByText("已打开存储数据文件。保存时会生成新版文件下载。");
    expect(await screen.findByText("imported-space")).toBeInTheDocument();
  });

  it("进入空间后锁定已加载的存储数据文件", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "新建存储数据文件夹" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    expect(
      screen.getByRole("button", { name: "新建存储数据文件夹" })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "新建空间" }));
    fireEvent.change(screen.getByLabelText("目标存储空间 ID"), {
      target: { value: "locked-space" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建并进入空间" }));

    await screen.findByText("空间：locked-space");
    expect(screen.getByText(/空间内已锁定当前加载文件/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "新建存储数据文件夹" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开存储数据文件夹" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("打开 current.json（下载新版模式）")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("存储数据保存操作")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "离开空间" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    expect(
      screen.getByRole("button", { name: "新建存储数据文件夹" })
    ).toBeEnabled();
  });

  it("空间外无空间时展示新建空间操作指引", async () => {
    renderApp();

    const guidancePanel = getGuidancePanel();
    expect(
      within(guidancePanel).getByRole("heading", { name: "打开存储数据" })
    ).toBeInTheDocument();
    expect(
      within(guidancePanel).getByText("打开或新建存储数据")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新建存储数据文件夹" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    fireEvent.click(
      within(getGuidancePanel()).getByRole("button", {
        name: "展开新建空间入口"
      })
    );
    expect(screen.getByLabelText("创建方式")).toBeInTheDocument();
  });

  it("空间外测试数据工具可以删除指定空间和清空全部数据", async () => {
    await saveSpace({
      spaceId: "victim",
      status: "active"
    });
    await saveSpace({
      spaceId: "reset-target",
      status: "active"
    });

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "新建存储数据文件夹" }));
    await screen.findByRole("heading", { name: "开发测试数据工具" });
    fireEvent.change(screen.getByLabelText("测试目标存储空间 ID"), {
      target: { value: "victim" }
    });
    await waitFor(() =>
      expect(screen.getByLabelText("测试目标存储空间 ID")).toHaveValue("victim")
    );
    fireEvent.click(screen.getByRole("button", { name: "测试：删除指定空间" }));
    await waitFor(() =>
      expect(
        screen.getByText("测试操作已删除存储空间 victim。")
      ).toBeInTheDocument()
    );
    await expect(getSpace("victim")).resolves.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "测试：清空全部本地数据" })
    );
    await waitFor(() =>
      expect(
        screen.getByText("测试操作已清空全部本地数据。")
      ).toBeInTheDocument()
    );
    await expect(getSpace("reset-target")).resolves.toBeNull();
  });

  it("空间外点击新建空间后才展示创建方式", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "新建存储数据文件夹" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    expect(
      screen.getByRole("button", { name: "新建空间" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("创建方式")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新建空间" }));
    expect(screen.getByLabelText("创建方式")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "空白创建" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "从已有的空间 clone 配置" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "从已有的空间 clone 配置 + 密码迁移队列"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "从导入文件创建空间" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "从导入文件创建空间 + 密码迁移队列" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("来源存储空间")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("导入 JSON")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("创建方式"), {
      target: { value: "clone_profile" }
    });
    expect(screen.getByLabelText("来源存储空间")).toBeInTheDocument();
    expect(screen.queryByLabelText("导入 JSON")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("创建方式"), {
      target: { value: "import_profile" }
    });
    expect(screen.queryByLabelText("来源存储空间")).not.toBeInTheDocument();
    expect(screen.getByLabelText("导入 JSON")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("创建方式"), {
      target: { value: "blank" }
    });
    fireEvent.change(screen.getByLabelText("目标存储空间 ID"), {
      target: { value: "next-space" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建并进入空间" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "已进入临时存储空间。在空间主页设置空间主密码后，可初始化规则链或创建密码。"
        )
      ).toBeInTheDocument()
    );
    expect(
      within(getGuidancePanel()).getByRole("heading", {
        name: "设置本次空间主密码"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "空间主页" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "迁移情况" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("空间：next-space")).toBeInTheDocument();
    expect(screen.getByText("状态：临时空间")).toBeInTheDocument();
    await expect(getSpace("next-space")).resolves.toBeNull();
    expect(
      screen.getByRole("heading", { name: "设置空间主密码" })
    ).toBeInTheDocument();
    await establishSpaceSession();
    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    expect(
      within(getGuidancePanel()).getByRole("heading", {
        name: "初始化空间规则链"
      })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("空间主密码")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "离开空间" }));
    await screen.findByRole("heading", { name: "本地空间索引" });
    expect(screen.queryByText("next-space")).not.toBeInTheDocument();
  });
});
