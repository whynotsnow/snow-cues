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

describe("密码条目管理", () => {
  it("同一时间只允许编辑一条密码，未保存修改会阻止切换", async () => {
    renderApp();

    await enterSpace();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    fireEvent.click(screen.getByRole("button", { name: "先初始化规则链" }));
    await screen.findByRole("button", { name: "确认初始化" });
    await confirmRuleProfileWithMaster();

    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "first-secret" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "First" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() =>
      expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "second-secret" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Second" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "编辑条目" })).toHaveLength(
        2
      )
    );

    fireEvent.click(screen.getAllByRole("button", { name: "编辑条目" })[0]);
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Second edited" }
    });
    fireEvent.click(screen.getByRole("button", { name: "编辑条目" }));
    await waitFor(() =>
      expect(
        screen.getByText("当前条目有未保存修改，请先保存或取消。")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "取消编辑" }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑条目" })[1]);
    expect(screen.getByLabelText("平台")).toHaveValue("First");
  });

  it("可以进入存储空间、生成、保存加密输出，并且不保存禁止的派生元数据", async () => {
    renderApp();

    expect(
      screen.queryByRole("heading", { name: "已存储密码" })
    ).not.toBeInTheDocument();

    await enterSpace();
    expect(screen.getByText("状态：临时空间")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "空间主页" })
    ).toBeInTheDocument();
    expect(screen.getByText("临时空间，尚未持久化")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("当前空间没有记录来源或接替关系。")
      ).toBeInTheDocument()
    );
    await expect(getSpace("default")).resolves.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "迁移情况" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(
      screen.getByRole("heading", { name: "已存储密码" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "先初始化规则链" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "先初始化规则链" }));
    await screen.findByRole("heading", { name: "规则链初始化" });
    expect(window.location.hash).toBe("#/rules");
    expectNoPageNotice();
    expect(
      within(getGuidancePanel()).getByRole("heading", {
        name: "设置本次空间主密码"
      })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("新建密码前需要先初始化存储空间规则链。")
      ).toBeInTheDocument()
    );
    await confirmRuleProfileWithMaster();
    expect(screen.getByText("状态：正常")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    expect(window.location.hash).toBe("#/passwords");
    expect(screen.getByRole("button", { name: "新建密码" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    expect(screen.getByText("当前生效规则链")).toBeInTheDocument();
    expect(screen.getByText(/读取已冻结的规则链/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Example" }
    });
    fireEvent.change(screen.getByLabelText("普通备注，可选"), {
      target: { value: "Primary" }
    });
    fireEvent.change(screen.getByLabelText("关键密钥记忆提示，可选"), {
      target: { value: "蓝色杯子旁边的提示" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));

    await waitFor(() =>
      expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("解密关键密钥")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("关键密钥记忆提示")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "解密" }));
    expect(screen.getByLabelText("解密关键密钥")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(
        screen.getByText("请输入用于加密或解密的关键密钥。")
      ).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "wrong-salt" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "解密失败，请检查关键密钥。该条目保存了关键密钥记忆提示，你可以查看提示后重试。"
        )
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "查看记忆提示" }));
    await waitFor(() =>
      expect(screen.getByText("蓝色杯子旁边的提示")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: "隐藏记忆提示" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "隐藏记忆提示" }));
    expect(screen.queryByText("蓝色杯子旁边的提示")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看记忆提示" }));
    await waitFor(() =>
      expect(screen.getByText("蓝色杯子旁边的提示")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "still-wrong" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(screen.getByText(/仍然无法解密/)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑条目" }));
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "显示提示" }));
    await waitFor(() =>
      expect(screen.getByText("蓝色杯子旁边的提示")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "隐藏提示" }));
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解锁编辑" }));
    await waitFor(() =>
      expect(screen.getByLabelText("关键密钥记忆提示")).toHaveValue(
        "蓝色杯子旁边的提示"
      )
    );
    fireEvent.change(screen.getByLabelText("关键密钥记忆提示"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存条目" }));
    await waitFor(() =>
      expect(screen.getByText("条目信息已更新。")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "查看记忆提示" }));
    await waitFor(() =>
      expect(screen.getByText("蓝色杯子旁边的提示")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑条目" }));
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解锁编辑" }));
    await waitFor(() =>
      expect(screen.getByLabelText("关键密钥记忆提示")).toHaveValue(
        "蓝色杯子旁边的提示"
      )
    );
    fireEvent.change(screen.getByLabelText("关键密钥记忆提示"), {
      target: { value: "改成抽屉里的卡片" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存条目" }));
    await waitFor(() =>
      expect(screen.getByText("条目信息已更新。")).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("关键密钥记忆提示")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看记忆提示" }));
    await waitFor(() =>
      expect(screen.getByText("改成抽屉里的卡片")).toBeInTheDocument()
    );
    expect(screen.queryByText("蓝色杯子旁边的提示")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑条目" }));
    fireEvent.click(screen.getByRole("button", { name: "解锁编辑" }));
    await waitFor(() =>
      expect(screen.getByLabelText("关键密钥记忆提示")).toHaveValue(
        "改成抽屉里的卡片"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "清除提示" }));
    await waitFor(() =>
      expect(screen.getByText("关键密钥记忆提示已清除。")).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "查看记忆提示" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "编辑条目" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(screen.queryByText("加密密码")).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "隐藏" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "解密" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "解密" }));
    expect(screen.getByLabelText("解密关键密钥")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(screen.queryByText("加密密码")).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "废弃" }));
    await waitFor(() =>
      expect(screen.getByText("密码已标记为废弃。")).toBeInTheDocument()
    );
    expect(screen.getByText("已废弃")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑条目" }));
    expect(screen.getByLabelText("平台")).toBeDisabled();
    expect(screen.getByText("当前不支持编辑密码")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "正在编辑" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "删除" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    expect(
      screen.getByRole("heading", { name: "规则管理" })
    ).toBeInTheDocument();
    expect(screen.getByText("已冻结规则链")).toBeInTheDocument();
    expect(screen.getAllByText("已冻结规则链")).toHaveLength(1);
    expect(
      screen.getByLabelText("导入声明式规则或规则数组")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "开发导入规则样例" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "填入批量导入样例" })
    ).toBeDisabled();

    const entries = (await listPasswordEntriesBySpace(
      "default"
    )) as unknown as Record<string, unknown>[];

    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty("master_password");
    expect(entries[0]).not.toHaveProperty("runtime_salt");
    expect(entries[0]).not.toHaveProperty("entrySecret");
    expect(entries[0]).not.toHaveProperty("memory_hint");
    expect(entries[0]).not.toHaveProperty("ruleId");
    expect(entries[0]).toHaveProperty("spaceId", "default");
    expect(entries[0].encrypted_memory_hint).toBeUndefined();
    expect(entries[0]).toHaveProperty("deprecatedAt");
  });
});
