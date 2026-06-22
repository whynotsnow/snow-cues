import { base64ToBytes, bytesToBase64, utf8ToBytes } from "../lib/bytes";

export type EncodingMode = "base64" | "base62" | "custom";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export type EncodingPolicy = {
  mode: EncodingMode;
  customCharset?: string;
  maxLength?: number;
};

export function encodePasswordMaterial(
  material: string,
  policy: EncodingPolicy
): string {
  const bytes = decodeRuleMaterial(material);
  const rawOutput =
    policy.mode === "base64"
      ? bytesToBase64(bytes)
      : policy.mode === "base62"
        ? mapBytesToCharset(bytes, BASE62_ALPHABET)
        : mapBytesToCharset(
            bytes,
            normalizeCustomCharset(policy.customCharset)
          );

  return policy.maxLength && policy.maxLength > 0
    ? rawOutput.slice(0, policy.maxLength)
    : rawOutput;
}

function decodeRuleMaterial(material: string): Uint8Array<ArrayBuffer> {
  try {
    return base64ToBytes(material);
  } catch {
    return utf8ToBytes(material);
  }
}

function normalizeCustomCharset(charset?: string): string {
  const uniqueChars = [...new Set(charset ?? "")].join("");
  if (uniqueChars.length < 2) {
    throw new Error("自定义字符集至少需要包含两个不同字符。");
  }
  return uniqueChars;
}

function mapBytesToCharset(bytes: Uint8Array, charset: string): string {
  let output = "";
  for (const byte of bytes) {
    output += charset[byte % charset.length];
  }
  return output;
}
