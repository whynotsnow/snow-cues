import { describe, expect, it } from "vitest";
import { createSession, isSessionExpired, touchSession, wipeSession } from "./session-manager";

describe("session-manager 会话管理", () => {
  it("创建不可导出的 WebCrypto key", async () => {
    const session = await createSession("correct horse battery staple");

    expect(session.cryptoKey.extractable).toBe(false);
    expect(session.storageKey.extractable).toBe(false);
  });

  it("可以检测空闲超时和绝对超时", async () => {
    const session = await createSession("master", { idleTimeoutMs: 100, absoluteTimeoutMs: 500 }, 1000);

    expect(isSessionExpired(session, 1050)).toBe(false);
    expect(isSessionExpired(session, 1100)).toBe(true);
    expect(isSessionExpired(session, 1500)).toBe(true);
  });

  it("刷新空闲时间不会超过绝对过期时间", async () => {
    const session = await createSession("master", { idleTimeoutMs: 100, absoluteTimeoutMs: 120 }, 1000);
    const touched = touchSession(session, 1000, 1050);

    expect(touched.idleExpiresAt).toBe(session.expiresAt);
  });

  it("可以清空会话引用", () => {
    expect(wipeSession()).toBeNull();
  });
});
