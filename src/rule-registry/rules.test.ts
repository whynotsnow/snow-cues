import { describe, expect, it } from "vitest";
import { generatePassword, generatePasswordWithRuleChain } from "../crypto-engine/crypto-engine";
import { createSession } from "../session-manager/session-manager";
import { createImportedRule, getRule, parseImportedRuleManifest } from "./rules";

describe("rule-registry 规则注册表", () => {
  it("拒绝不可用规则", () => {
    expect(() => getRule("v3-argon2")).toThrow("规则不可用");
  });

  it("同一 key、salt 与 rule 会生成确定性输出", async () => {
    const session = await createSession("master");
    const first = await generatePassword(session.cryptoKey, "example.com:alice", "v1-hmac", {
      mode: "base62",
      maxLength: 24
    });
    const second = await generatePassword(session.cryptoKey, "example.com:alice", "v1-hmac", {
      mode: "base62",
      maxLength: 24
    });

    expect(first.encodedPassword).toBe(second.encodedPassword);
  });

  it("salt 或 rule 改变时输出也会改变", async () => {
    const session = await createSession("master");
    const first = await generatePassword(session.cryptoKey, "one", "v1-hmac", { mode: "base62", maxLength: 24 });
    const second = await generatePassword(session.cryptoKey, "two", "v1-hmac", { mode: "base62", maxLength: 24 });
    const third = await generatePassword(session.cryptoKey, "one", "v2-pbkdf2", { mode: "base62", maxLength: 24 });

    expect(first.encodedPassword).not.toBe(second.encodedPassword);
    expect(first.encodedPassword).not.toBe(third.encodedPassword);
  });

  it("多规则链会按顺序影响最终输出", async () => {
    const session = await createSession("master");
    const first = await generatePasswordWithRuleChain(session.cryptoKey, "one", ["v1-hmac", "v2-pbkdf2"], {
      mode: "base62",
      maxLength: 24
    });
    const second = await generatePasswordWithRuleChain(session.cryptoKey, "one", ["v2-pbkdf2", "v1-hmac"], {
      mode: "base62",
      maxLength: 24
    });

    expect(first.encodedPassword).not.toBe(second.encodedPassword);
    expect(first.appliedRuleIds).toEqual(["v1-hmac", "v2-pbkdf2"]);
  });

  it("只接受声明式导入规则，不执行代码", async () => {
    const manifest = parseImportedRuleManifest(
      JSON.stringify({
        id: "imported-office",
        name: "办公规则",
        algorithm: "hmac-sha256",
        namespace: "office"
      })
    );
    const importedRule = createImportedRule(manifest);
    const session = await createSession("master");
    const result = await generatePassword(
      session.cryptoKey,
      "example.com:alice",
      importedRule.id,
      { mode: "base62", maxLength: 24 },
      [importedRule]
    );

    expect(result.encodedPassword).toHaveLength(24);
  });

  it("拒绝非声明式算法导入", () => {
    expect(() =>
      parseImportedRuleManifest(
        JSON.stringify({
          id: "imported-evil",
          name: "恶意规则",
          algorithm: "javascript",
          code: "fetch('/secret')"
        })
      )
    ).toThrow("导入规则只允许");
  });
});
