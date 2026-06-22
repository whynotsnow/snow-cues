import { utf8ToBytes } from "../lib/bytes";

const SESSION_HMAC_SALT = utf8ToBytes("snow-cues:v1.0:session:hmac-key");
const SESSION_STORAGE_SALT = utf8ToBytes("snow-cues:v1.0:session:storage-key");
const SESSION_ITERATIONS = 310_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 30 * 60 * 1000;

export type Session = {
  cryptoKey: CryptoKey;
  storageKey: CryptoKey;
  createdAt: number;
  expiresAt: number;
  idleExpiresAt: number;
};

export type SessionTimeouts = {
  idleTimeoutMs?: number;
  absoluteTimeoutMs?: number;
};

export async function createSession(
  masterPassword: string,
  timeouts: SessionTimeouts = {},
  now = Date.now()
): Promise<Session> {
  if (!masterPassword) {
    throw new Error("请输入 master_password。");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: SESSION_HMAC_SALT,
      iterations: SESSION_ITERATIONS
    },
    keyMaterial,
    {
      name: "HMAC",
      hash: "SHA-256",
      length: 256
    },
    false,
    ["sign"]
  );

  const storageKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: SESSION_STORAGE_SALT,
      iterations: SESSION_ITERATIONS
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  return {
    cryptoKey,
    storageKey,
    createdAt: now,
    expiresAt:
      now + (timeouts.absoluteTimeoutMs ?? DEFAULT_ABSOLUTE_TIMEOUT_MS),
    idleExpiresAt: now + (timeouts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
  };
}

export function isSessionExpired(
  session: Session | null,
  now = Date.now()
): boolean {
  return !session || now >= session.expiresAt || now >= session.idleExpiresAt;
}

export function touchSession(
  session: Session,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  now = Date.now()
): Session {
  return {
    ...session,
    idleExpiresAt: Math.min(session.expiresAt, now + idleTimeoutMs)
  };
}

export function wipeSession(): null {
  return null;
}
