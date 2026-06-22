import { describe, expect, it } from "vitest";
import { createSession } from "../session-manager/session-manager";
import { decryptMemoryHint, encryptMemoryHint } from "./recovery-aid";

describe("recovery-aid 关键密钥记忆提示", () => {
  it("同一 session、spaceId 和 entryId 可以解密提示", async () => {
    const session = await createSession("master");
    const encrypted = await encryptMemoryHint(session, "default", "entry-1", "第一只杯子");

    await expect(decryptMemoryHint(session, "default", "entry-1", encrypted)).resolves.toBe("第一只杯子");
  });

  it("错误 master_password 派生的 session 不能解密提示", async () => {
    const session = await createSession("master");
    const wrongSession = await createSession("wrong-master");
    const encrypted = await encryptMemoryHint(session, "default", "entry-1", "第一只杯子");

    await expect(decryptMemoryHint(wrongSession, "default", "entry-1", encrypted)).rejects.toThrow();
  });

  it("不同 entryId 不能互相解密提示", async () => {
    const session = await createSession("master");
    const encrypted = await encryptMemoryHint(session, "default", "entry-1", "第一只杯子");

    await expect(decryptMemoryHint(session, "default", "entry-2", encrypted)).rejects.toThrow();
  });

  it("不同 spaceId 不能互相解密提示", async () => {
    const session = await createSession("master");
    const encrypted = await encryptMemoryHint(session, "default", "entry-1", "第一只杯子");

    await expect(decryptMemoryHint(session, "work", "entry-1", encrypted)).rejects.toThrow();
  });

  it("提示加密不依赖关键密钥", async () => {
    const session = await createSession("master");
    const encrypted = await encryptMemoryHint(session, "default", "entry-1", "第一只杯子");

    await expect(decryptMemoryHint(session, "default", "entry-1", encrypted)).resolves.toBe("第一只杯子");
  });

  it("空提示不会生成 encrypted_memory_hint", async () => {
    const session = await createSession("master");

    await expect(encryptMemoryHint(session, "default", "entry-1", "   ")).rejects.toThrow("记忆提示为空。");
  });
});
