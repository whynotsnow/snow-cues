import { describe, expect, it } from "vitest";
import { createSession } from "../session-manager/session-manager";
import { decryptPassword, deriveRuntimeStorageKey, encryptPassword, generateDetachedPassword } from "./crypto-engine";

describe("crypto-engine 加密", () => {
  it("可以完成 AES-GCM 加密密码的往返解密", async () => {
    const session = await createSession("master");
    const encrypted = await encryptPassword(session.storageKey, "S3cure-Passw0rd");

    await expect(decryptPassword(session.storageKey, encrypted)).resolves.toBe("S3cure-Passw0rd");
  });

  it("使用不同 storage key 解密会失败", async () => {
    const first = await createSession("master-one");
    const second = await createSession("master-two");
    const encrypted = await encryptPassword(first.storageKey, "S3cure-Passw0rd");

    await expect(decryptPassword(second.storageKey, encrypted)).rejects.toThrow();
  });

  it("关键密钥参与条目加密 key 派生", async () => {
    const session = await createSession("master");
    const firstKey = await deriveRuntimeStorageKey(session.cryptoKey, "example.com:alice");
    const secondKey = await deriveRuntimeStorageKey(session.cryptoKey, "example.com:bob");
    const encrypted = await encryptPassword(firstKey, "S3cure-Passw0rd");

    await expect(decryptPassword(firstKey, encrypted)).resolves.toBe("S3cure-Passw0rd");
    await expect(decryptPassword(secondKey, encrypted)).rejects.toThrow();
  });

  it("游离密码使用派生密钥确定生成", async () => {
    const first = await generateDetachedPassword("temporary-key", { mode: "base62", maxLength: 24 });
    const second = await generateDetachedPassword("temporary-key", { mode: "base62", maxLength: 24 });
    const third = await generateDetachedPassword("another-key", { mode: "base62", maxLength: 24 });

    expect(first.encodedPassword).toBe(second.encodedPassword);
    expect(first.encodedPassword).not.toBe(third.encodedPassword);
    expect(first.appliedRuleIds).toEqual(["v1-hmac", "v2-pbkdf2"]);
  });

  it("游离密码拒绝空派生密钥和无效自定义字符集", async () => {
    await expect(generateDetachedPassword(" ", { mode: "base62", maxLength: 24 })).rejects.toThrow("请输入派生密钥");
    await expect(generateDetachedPassword("temporary-key", { mode: "custom", customCharset: "aa", maxLength: 24 })).rejects.toThrow(
      "自定义字符集至少需要包含两个不同字符"
    );
  });
});
