import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ActionGroup,
  Button,
  Card,
  CheckboxField,
  CopyableSecret,
  EmptyState,
  SectionHeader,
  TextField
} from "./index";

describe("design-system", () => {
  it("renders Button variants and loading state", () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick} variant="primary">
          保存
        </Button>
        <Button loading loadingLabel="保存中...">
          保存
        </Button>
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
  });

  it("renders Field label and hint", () => {
    render(
      <TextField
        hint="不会保存到本地"
        label="关键密钥"
        onChange={() => undefined}
        value=""
      />
    );

    expect(screen.getByLabelText("关键密钥")).toBeInTheDocument();
    expect(screen.getByText("不会保存到本地")).toBeInTheDocument();
  });

  it("renders CheckboxField accessibly", () => {
    render(
      <CheckboxField
        checked={false}
        label="应用输出策略"
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("应用输出策略")).toHaveAttribute(
      "type",
      "checkbox"
    );
  });

  it("renders Card, SectionHeader, ActionGroup and EmptyState", () => {
    render(
      <Card aria-label="测试卡片">
        <SectionHeader
          actions={
            <ActionGroup>
              <Button>刷新</Button>
            </ActionGroup>
          }
          description="卡片说明"
          title="卡片标题"
        />
        <EmptyState>暂无数据</EmptyState>
      </Card>
    );

    expect(screen.getByLabelText("测试卡片")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "卡片标题" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });

  it("copies CopyableSecret values and reports status", async () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    try {
      render(<CopyableSecret label="已解密核心密码" value="secret-value" />);

      fireEvent.click(screen.getByRole("button", { name: "复制" }));

      expect(writeText).toHaveBeenCalledWith("secret-value");
      expect(await screen.findByRole("status")).toHaveTextContent("已复制。");
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard
      });
    }
  });
});
