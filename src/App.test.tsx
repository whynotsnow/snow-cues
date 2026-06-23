import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getSpace, listPasswordEntriesBySpace } from "./storage-data";
import {
  confirmRuleProfileWithMaster,
  enterSpace,
  establishSpaceSession,
  renderApp,
  resetAppTestEnvironment
} from "./test/appTestHelpers";

beforeEach(resetAppTestEnvironment);

describe("Snow Cues 应用冒烟流程", () => {
  it("缺少 WebCrypto 核心能力时阻断存储数据入口", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto)
      } as Crypto,
      configurable: true
    });

    try {
      renderApp();

      expect(
        screen.getAllByText("当前环境不支持安全加密")[0]
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/请使用 Cloudflare Pages HTTPS 正式地址/)[0]
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "新建存储数据" })
      ).toBeDisabled();
      expect(screen.getByLabelText("导入 current.json")).toBeDisabled();
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true
      });
    }
  });

  it("缺少文件夹访问能力时提示文件导入导出但不阻断新建存储数据", async () => {
    renderApp();

    expect(screen.getByText("当前使用文件导入导出")).toBeInTheDocument();
    expect(
      screen.getByText(/将通过导入 current.json 和下载保存包/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开存储数据" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新建存储数据" }));
    await screen.findByText(/存储数据 ID/);
    expect(
      screen.getByRole("link", { name: "下载保存包 .zip" })
    ).toHaveAttribute("download", expect.stringMatching(/\.zip$/));
  });

  it("可以完成空间主链路冒烟", async () => {
    renderApp();

    await enterSpace();
    await establishSpaceSession();
    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    await confirmRuleProfileWithMaster();
    fireEvent.click(screen.getByRole("button", { name: "密码管理" }));
    fireEvent.click(screen.getByRole("button", { name: "新建密码" }));
    fireEvent.change(screen.getByLabelText("关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "Example" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并保存/i }));
    await waitFor(() =>
      expect(screen.getByText("新密码已生成并加密保存。")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "保存存储数据" }));
    await screen.findByRole("heading", { name: "保存前摘要" });
    fireEvent.click(screen.getByRole("button", { name: "确认保存存储数据" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "已保存存储数据并生成桌面保存包。请下载 zip，编辑 storageData-path.txt 后运行脚本。"
        )
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: "下载保存包 .zip" })
    ).toHaveAttribute("download", expect.stringMatching(/\.zip$/));

    fireEvent.click(screen.getByRole("button", { name: "解密" }));
    fireEvent.change(screen.getByLabelText("解密关键密钥"), {
      target: { value: "example.com:alice" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认解密" }));
    await waitFor(() =>
      expect(screen.getByText("已解密核心密码")).toBeInTheDocument()
    );

    await expect(getSpace("default")).resolves.toMatchObject({
      status: "active"
    });
    const entries = await listPasswordEntriesBySpace("default");
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty("master_password");
    expect(entries[0]).not.toHaveProperty("entrySecret");
    expect(entries[0]).not.toHaveProperty("runtime_salt");
    expect(entries[0]).toHaveProperty("spaceId", "default");
  });

  it("批量导入声明式规则后可以确认初始化并返回密码管理", async () => {
    renderApp();

    await enterSpace();

    fireEvent.click(screen.getByRole("button", { name: "规则管理" }));
    fireEvent.change(screen.getByLabelText("导入声明式规则或规则数组"), {
      target: {
        value: JSON.stringify([
          {
            id: "imported-office",
            name: "办公规则",
            algorithm: "hmac-sha256",
            namespace: "office"
          },
          {
            id: "imported-finance",
            name: "财务规则",
            algorithm: "pbkdf2-sha256",
            namespace: "finance",
            iterations: 260_000
          }
        ])
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "导入规则" }));
    await waitFor(() =>
      expect(
        screen.getByText("已导入 2 条规则，初始化前可加入规则链。")
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getAllByRole("button", { name: "删除规则" })[0]);
    expect(window.confirm).toHaveBeenCalledWith(
      "确认删除这条导入规则？未初始化前删除不会影响已保存密码。"
    );

    await confirmRuleProfileWithMaster();
    expect(window.confirm).toHaveBeenCalledWith(
      "确认初始化规则链？初始化后本空间会冻结这组规则链，本次会话内不能再导入、停用、重命名或删除参与规则。"
    );
    expect(
      screen.getByRole("heading", { name: "已存储密码" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新建密码" })
    ).toBeInTheDocument();
  });
});
