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
  generatePasswordWithRuleChain
} from "../../crypto-engine/crypto-engine";
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

describe("密码组与输出适配", () => {
  it("可以创建密码组并在解密后进行密码输出适配", async () => {
    renderApp();

    await enterSpace();
    await establishSpaceSession();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(
      screen.queryByRole("heading", { name: "密码组输出适配" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "输出适配" }));

    fireEvent.change(screen.getByLabelText("密码组名称"), {
      target: { value: "代码托管" }
    });
    fireEvent.change(screen.getByLabelText("说明，可选"), {
      target: { value: "隐私元数据" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建密码组" }));
    await waitFor(() =>
      expect(screen.getByText("密码组已创建。")).toBeInTheDocument()
    );
    expect(screen.getByText(/通用强密码 · 16 位/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    fireEvent.click(screen.getByRole("button", { name: "先初始化规则链" }));
    await waitFor(() =>
      expect(
        screen.getByText("新建密码前需要先初始化存储空间规则链。")
      ).toBeInTheDocument()
    );
    await confirmRuleProfileWithMaster();
    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("所属密码组，可选"), {
      target: {
        value:
          screen
            .getByRole("option", { name: "代码托管" })
            .getAttribute("value") ?? ""
      }
    });
    expect(screen.getByLabelText("平台")).toHaveValue("代码托管");
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() =>
      expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument()
    );
    expect(screen.getByText("密码组")).toBeInTheDocument();
    expect(screen.getAllByText("代码托管").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "解密" }));
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(screen.getByText("已解密核心密码")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText("密码输出适配")).toBeInTheDocument()
    );
    expect(screen.getByText("适配密码")).toBeInTheDocument();
    expect(screen.queryByLabelText("常见策略预设")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存为组输出策略" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "调整输出策略" }));
    expect(screen.getByLabelText("常见策略预设")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "保存为组输出策略" })
    ).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("常见策略预设"), {
      target: { value: "pin" }
    });
    await waitFor(() =>
      expect(screen.getByText("密码输出适配")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "保存为组输出策略" }));
    await waitFor(() =>
      expect(screen.getByText("密码组输出适配已保存。")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "输出适配" }));
    expect(screen.getByText(/数字 PIN · 6 位/)).toBeInTheDocument();
  });
});
