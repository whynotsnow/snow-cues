export type BrowserCapabilities = {
  secureContext: boolean;
  cryptoAvailable: boolean;
  subtleCryptoAvailable: boolean;
  randomValuesAvailable: boolean;
  coreCryptoAvailable: boolean;
  storageFolderAccessAvailable: boolean;
  isMobileLike: boolean;
  coreCryptoUnavailableMessage: string;
  storageFolderAccessUnavailableMessage: string;
};

export const CORE_CRYPTO_UNAVAILABLE_MESSAGE =
  "当前浏览器环境不支持 Snow Cues 所需的安全加密能力。请使用 Cloudflare Pages HTTPS 正式地址、已安装的 PWA，或受信任的 localhost / 127.0.0.1 环境打开。";

export const STORAGE_FOLDER_ACCESS_UNAVAILABLE_MESSAGE =
  "当前浏览器将通过导入 current.json 和下载保存包维护 storageData。";

export function detectBrowserCapabilities(): BrowserCapabilities {
  const cryptoApi = globalThis.crypto;
  const secureContext =
    typeof window !== "undefined" && window.isSecureContext === true;
  const cryptoAvailable = typeof cryptoApi === "object" && cryptoApi !== null;
  const subtleCryptoAvailable =
    cryptoAvailable && typeof cryptoApi.subtle === "object";
  const randomValuesAvailable =
    cryptoAvailable && typeof cryptoApi.getRandomValues === "function";
  const storageFolderAccessAvailable =
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function";
  const isMobileLike = detectMobileLike();

  return {
    secureContext,
    cryptoAvailable,
    subtleCryptoAvailable,
    randomValuesAvailable,
    coreCryptoAvailable:
      secureContext &&
      cryptoAvailable &&
      subtleCryptoAvailable &&
      randomValuesAvailable,
    storageFolderAccessAvailable,
    isMobileLike,
    coreCryptoUnavailableMessage: CORE_CRYPTO_UNAVAILABLE_MESSAGE,
    storageFolderAccessUnavailableMessage:
      STORAGE_FOLDER_ACCESS_UNAVAILABLE_MESSAGE
  };
}

function detectMobileLike(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const userAgent = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}
