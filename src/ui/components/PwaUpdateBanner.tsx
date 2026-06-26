import { useEffect, useState } from "react";
import {
  usePwaUpdate,
  type PwaRegisterFunction,
  type PwaUpdateState
} from "../hooks/usePwaUpdate";

type PwaUpdateBannerProps = {
  /**
   * 可选的注入状态，仅用于测试覆盖。
   * 不传时走生产路径，由内部 usePwaUpdate 自动注册 Service Worker。
   */
  pwaUpdateState?: PwaUpdateState;
  /**
   * 可选的注册函数注入，仅用于测试绕过虚拟模块解析。
   */
  registerFn?: PwaRegisterFunction | null;
};

/**
 * PWA 新版本可用提示横幅。
 *
 * 全局挂载在 App 顶层，跨越所有路由，在检测到新版 Service Worker 时展示。
 * 采用 prompt 模式：用户点击“立即刷新”才会激活新版本并重新加载，
 * 绝不打断进行中的解密 / 编辑会话；点击“稍后”则暂缓到下一次检测。
 *
 * 该组件自管状态，不依赖 AppController，也不复用 useSystemNotifications
 * （后者在浏览器通知权限授予时会委托系统级 Notification，不适合版本更新提示）。
 */
export function PwaUpdateBanner({
  pwaUpdateState,
  registerFn
}: PwaUpdateBannerProps) {
  const defaultState = usePwaUpdate(registerFn);
  const { needRefresh, offlineReady, update, dismiss } =
    pwaUpdateState ?? defaultState;

  // offlineReady 是一次性信号，用本地 state 控制 toast 可见性，4.5s 后自动消失。
  // 一旦出现 needRefresh，就不再展示离线提示，避免与刷新横幅重叠。
  const [offlineToastVisible, setOfflineToastVisible] = useState(false);
  useEffect(() => {
    if (offlineReady && !needRefresh) {
      setOfflineToastVisible(true);
      const timer = window.setTimeout(
        () => setOfflineToastVisible(false),
        4500
      );
      return () => window.clearTimeout(timer);
    }
    setOfflineToastVisible(false);
    return;
  }, [offlineReady, needRefresh]);

  if (needRefresh) {
    return (
      <div
        className="pwa-update-banner pwa-update-banner-refresh"
        role="alert"
        aria-live="assertive"
      >
        <div className="pwa-update-banner-content">
          <strong>检测到新版本可用。</strong>
          <span>刷新后将加载最新版本。</span>
        </div>
        <div className="pwa-update-banner-actions">
          <button
            type="button"
            className="pwa-update-banner-button-primary"
            onClick={update}
          >
            立即刷新
          </button>
          <button
            type="button"
            className="pwa-update-banner-button-ghost"
            onClick={dismiss}
          >
            稍后
          </button>
        </div>
      </div>
    );
  }

  if (offlineToastVisible) {
    return (
      <div
        className="pwa-update-banner pwa-update-banner-offline"
        role="status"
        aria-live="polite"
      >
        <div className="pwa-update-banner-content">
          <strong>应用已可离线使用。</strong>
        </div>
      </div>
    );
  }

  return null;
}
