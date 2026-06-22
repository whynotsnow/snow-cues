import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  concatBytes,
  utf8ToBytes
} from "../lib/bytes";
import type { Session } from "../session-manager/session-manager";

const MEMORY_HINT_PURPOSE = "snow-cues:memory-hint:v1";

export async function encryptMemoryHint(
  session: Session,
  spaceId: string,
  entryId: string,
  memoryHint: string
): Promise<string> {
  const hint = memoryHint.trim();
  if (!hint) {
    throw new Error("记忆提示为空。");
  }

  const key = await deriveMemoryHintKey(session, spaceId, entryId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    utf8ToBytes(hint)
  );

  return bytesToBase64(concatBytes(iv, new Uint8Array(ciphertext)));
}

export async function decryptMemoryHint(
  session: Session,
  spaceId: string,
  entryId: string,
  encryptedMemoryHint: string
): Promise<string> {
  const sealedBytes = base64ToBytes(encryptedMemoryHint);
  if (sealedBytes.length <= 12) {
    throw new Error("记忆提示数据无效。");
  }

  const key = await deriveMemoryHintKey(session, spaceId, entryId);
  const iv = sealedBytes.slice(0, 12);
  const ciphertext = sealedBytes.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    ciphertext
  );

  return bytesToUtf8(new Uint8Array(plaintext));
}

async function deriveMemoryHintKey(
  session: Session,
  spaceId: string,
  entryId: string
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.sign(
    "HMAC",
    session.cryptoKey,
    utf8ToBytes(`${MEMORY_HINT_PURPOSE}:${spaceId}:${entryId}`)
  );

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
