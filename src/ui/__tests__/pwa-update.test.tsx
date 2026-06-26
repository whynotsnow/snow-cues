import { act, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { PwaUpdateBanner } from "../components/PwaUpdateBanner";
import { usePwaUpdate, type PwaRegisterFunction } from "../hooks/usePwaUpdate";

// jsdom 默认不带 navigator.serviceWorker；usePwaUpdate 依赖其存在性做降级判断，
// 因此在每个 hook 测试前补一个最小桩，测试后还原。
function stubServiceWorker() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {}
  });
}

function clearServiceWorker() {
  // @ts-expect-error 测试中删除运行时桩
  delete navigator.serviceWorker;
}

function buildRegisterFn(): {
  registerFn: PwaRegisterFunction;
  fireNeedRefresh: () => void;
  fireOfflineReady: () => void;
  activate: ReturnType<PwaRegisterFunction>;
} {
  let onNeedRefresh: (() => void) | undefined;
  let onOfflineReady: (() => void) | undefined;
  const activate = vi.fn(() => Promise.resolve());
  const registerFn: PwaRegisterFunction = (options) => {
    onNeedRefresh = options?.onNeedRefresh;
    onOfflineReady = options?.onOfflineReady;
    return activate;
  };
  return {
    registerFn,
    fireNeedRefresh: () => onNeedRefresh?.(),
    fireOfflineReady: () => onOfflineReady?.(),
    activate
  };
}

describe("usePwaUpdate", () => {
  beforeEach(stubServiceWorker);
  afterEach(clearServiceWorker);

  it("在不支持 Service Worker 的环境下安全降级，不展示更新提示", () => {
    clearServiceWorker();
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(false);
    expect(result.current.offlineReady).toBe(false);
  });

  it("注入的 registerFn 触发 onNeedRefresh 后置为需要刷新", () => {
    const { registerFn, fireNeedRefresh } = buildRegisterFn();
    const { result } = renderHook(() => usePwaUpdate(registerFn));
    act(() => fireNeedRefresh());
    expect(result.current.needRefresh).toBe(true);
  });

  it("dismiss 清除 needRefresh 状态", () => {
    const { registerFn, fireNeedRefresh } = buildRegisterFn();
    const { result } = renderHook(() => usePwaUpdate(registerFn));
    act(() => fireNeedRefresh());
    act(() => result.current.dismiss());
    expect(result.current.needRefresh).toBe(false);
  });

  it("update 调用 register 返回的激活函数", () => {
    const { registerFn, fireNeedRefresh, activate } = buildRegisterFn();
    const { result } = renderHook(() => usePwaUpdate(registerFn));
    act(() => fireNeedRefresh());
    act(() => result.current.update());
    expect(activate).toHaveBeenCalledWith(true);
  });
});

describe("PwaUpdateBanner", () => {
  it("needRefresh 为 false 时不渲染任何内容", () => {
    const { container } = render(
      <PwaUpdateBanner
        pwaUpdateState={{
          needRefresh: false,
          offlineReady: false,
          update: () => {},
          dismiss: () => {}
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("needRefresh 为 true 时渲染刷新横幅和两个按钮", () => {
    render(
      <PwaUpdateBanner
        pwaUpdateState={{
          needRefresh: true,
          offlineReady: false,
          update: () => {},
          dismiss: () => {}
        }}
      />
    );
    expect(screen.getByText("检测到新版本可用。")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "立即刷新" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "稍后" })).toBeInTheDocument();
  });

  it("点击立即刷新触发 update 回调", () => {
    const update = vi.fn();
    render(
      <PwaUpdateBanner
        pwaUpdateState={{
          needRefresh: true,
          offlineReady: false,
          update,
          dismiss: () => {}
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "立即刷新" }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("点击稍后触发 dismiss 回调", () => {
    const dismiss = vi.fn();
    render(
      <PwaUpdateBanner
        pwaUpdateState={{
          needRefresh: true,
          offlineReady: false,
          update: () => {},
          dismiss
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "稍后" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
