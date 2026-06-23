export type BrowserCapabilities = {
  secureContext: boolean;
  cryptoAvailable: boolean;
  subtleCryptoAvailable: boolean;
  randomValuesAvailable: boolean;
  coreCryptoAvailable: boolean;
  storageFolderAccessAvailable: boolean;
  coreCryptoUnavailableMessage: string;
  storageFolderAccessUnavailableMessage: string;
};

export const CORE_CRYPTO_UNAVAILABLE_MESSAGE =
  "当前浏览器环境不支持 Snow Cues 所需的安全加密能力。请使用 Cloudflare Pages HTTPS 正式地址、已安装的 PWA，或受信任的 localhost / 127.0.0.1 环境打开。";

export const STORAGE_FOLDER_ACCESS_UNAVAILABLE_MESSAGE =
  "当前浏览器不支持文件夹直接保存，请使用打开 current.json 和下载新版 current.json 的模式维护 storageData。";

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
    coreCryptoUnavailableMessage: CORE_CRYPTO_UNAVAILABLE_MESSAGE,
    storageFolderAccessUnavailableMessage:
      STORAGE_FOLDER_ACCESS_UNAVAILABLE_MESSAGE
  };
}
