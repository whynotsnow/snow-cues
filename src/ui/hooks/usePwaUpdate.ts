import { useCallback, useEffect, useRef, useState } from "react";
import type { RegisterSWOptions } from "virtual:pwa-register";

/**
 * PWA SW 注册函数类型。
 *
 * 对齐 `vite-plugin-pwa` 的 `virtual:pwa-register` 在 `registerType: "prompt"` 下
 * 导出的 `registerSW`：传入回调选项，返回一个 `updateServiceWorker` 函数。
 * `updateServiceWorker` 内部会通知新版 SW 跳过等待并重新加载页面。
 *
 * 抽象成可注入参数，是为了让测试在不经过 Vite 虚拟模块解析的情况下也能覆盖该 hook。
 */
export type PwaRegisterFunction = (
  options?: RegisterSWOptions
) => (reloadPage?: boolean) => Promise<void>;

export type PwaUpdateState = {
  /** 是否检测到新版本。为 true 时 UI 应展示更新提示。 */
  needRefresh: boolean;
  /** 应用外壳是否已可离线使用（首次 SW 安装完成的信号）。 */
  offlineReady: boolean;
  /** 激活新版本：通知 SW 跳过等待并重新加载页面。 */
  update: () => void;
  /** 用户暂缓本次更新，隐藏提示直到下一次检测。 */
  dismiss: () => void;
};

/**
 * 默认注册函数：从 `vite-plugin-pwa` 的虚拟模块加载。
 *
 * 这一层间接允许在生产构建时由 Vite 解析虚拟模块，
 * 同时让单元测试通过传入自定义 `registerFn` 绕过该解析。
 */
async function loadDefaultRegister(): Promise<PwaRegisterFunction | null> {
  try {
    const mod = await import("virtual:pwa-register");
    return mod.registerSW as PwaRegisterFunction;
  } catch {
    // 当前环境（如 jsdom、开发期未启用 SW、或构建产物外直接运行）无法解析虚拟模块，
    // 视为 PWA 注册不可用，hook 会安全降级为不展示任何提示。
    return null;
  }
}

/**
 * 注册 Service Worker 并以 prompt 模式暴露更新状态。
 *
 * 设计要点：
 * - prompt 模式下，新版 SW 只在后台安装，不会自动激活；
 *   只有调用 `update()` 才会触发 `SKIP_WAITING` 并重新加载，
 *   保证进行中的解密 / 编辑会话绝不被中途打断。
 * - 在不支持 Service Worker 的环境（jsdom、非安全上下文、开发期禁用 SW）下，
 *   hook 安全降级，`needRefresh` 始终为 false，不抛错。
 */
export function usePwaUpdate(
  registerFn?: PwaRegisterFunction | null
): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  // 保留 register 返回的 updateServiceWorker，供用户点击“刷新”时调用。
  const updateServiceWorkerRef = useRef<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      const register =
        registerFn !== undefined ? registerFn : await loadDefaultRegister();
      if (cancelled || !register) {
        return;
      }
      updateServiceWorkerRef.current = register({
        onNeedRefresh: () => setNeedRefresh(true),
        onOfflineReady: () => setOfflineReady(true),
        onRegisterError: () => {
          // 注册失败不阻断应用，静默忽略；用户仍可正常使用在线功能。
        }
      });
    };

    run();

    return () => {
      cancelled = true;
      updateServiceWorkerRef.current = null;
    };
  }, [registerFn]);

  const update = useCallback(() => {
    const activate = updateServiceWorkerRef.current;
    if (activate) {
      // updateServiceWorker(true) 会通知 waiting SW 跳过等待并重新加载页面。
      void activate(true);
      return;
    }
    // 兜底：注册函数不可用时直接重新加载当前页面。
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return {
    needRefresh,
    offlineReady,
    update,
    dismiss
  };
}
