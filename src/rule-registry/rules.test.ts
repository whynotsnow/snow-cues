import { describe, expect, it } from "vitest";
import {
  generatePassword,
  generatePasswordWithRuleChain
} from "../crypto-engine/crypto-engine";
import { createSession } from "../session-manager/session-manager";
import {
  createImportedRule,
  getRule,
  parseImportedRuleManifest
} from "./rules";
import {
  ImportedRuleAlgorithmRegistry,
  supportedImportedRuleAlgorithms
} from "./imported-rule-algorithms";

describe("rule-registry 规则注册表", () => {
  it("拒绝不可用规则", () => {
    expect(() => getRule("v3-argon2")).toThrow("规则不可用");
  });

  it("同一 key、salt 与 rule 会生成确定性输出", async () => {
    const session = await createSession("master");
    const first = await generatePassword(
      session.cryptoKey,
      "example.com:alice",
      "v1-hmac",
      {
        mode: "base62",
        maxLength: 24
      }
    );
    const second = await generatePassword(
      session.cryptoKey,
      "example.com:alice",
      "v1-hmac",
      {
        mode: "base62",
        maxLength: 24
      }
    );

    expect(first.encodedPassword).toBe(second.encodedPassword);
  });

  it("salt 或 rule 改变时输出也会改变", async () => {
    const session = await createSession("master");
    const first = await generatePassword(session.cryptoKey, "one", "v1-hmac", {
      mode: "base62",
      maxLength: 24
    });
    const second = await generatePassword(session.cryptoKey, "two", "v1-hmac", {
      mode: "base62",
      maxLength: 24
    });
    const third = await generatePassword(
      session.cryptoKey,
      "one",
      "v2-pbkdf2",
      { mode: "base62", maxLength: 24 }
    );

    expect(first.encodedPassword).not.toBe(second.encodedPassword);
    expect(first.encodedPassword).not.toBe(third.encodedPassword);
  });

  it("多规则链会按顺序影响最终输出", async () => {
    const session = await createSession("master");
    const first = await generatePasswordWithRuleChain(
      session.cryptoKey,
      "one",
      ["v1-hmac", "v2-pbkdf2"],
      {
        mode: "base62",
        maxLength: 24
      }
    );
    const second = await generatePasswordWithRuleChain(
      session.cryptoKey,
      "one",
      ["v2-pbkdf2", "v1-hmac"],
      {
        mode: "base62",
        maxLength: 24
      }
    );

    expect(first.encodedPassword).not.toBe(second.encodedPassword);
    expect(first.appliedRuleIds).toEqual(["v1-hmac", "v2-pbkdf2"]);
  });

  it("只接受声明式导入规则，不执行代码", async () => {
    const manifest = parseImportedRuleManifest(
      JSON.stringify({
        id: "imported-office",
        name: "办公规则",
        algorithm: "hmac-sha256",
        namespace: "office",
        params: {
          saltPrefix: "office-v1"
        }
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
    expect(manifest.params).toEqual({ saltPrefix: "office-v1" });
  });

  it("导入规则通过算法注册表创建执行模板", async () => {
    const manifest = parseImportedRuleManifest(
      JSON.stringify({
        id: "imported-finance",
        name: "财务规则",
        algorithm: "pbkdf2-sha256",
        namespace: "finance",
        iterations: 260_000,
        params: {
          iterations: 320_000,
          materialLabel: "material-v2",
          saltLabel: "salt-v2"
        }
      })
    );
    const importedRule = createImportedRule(manifest);
    const session = await createSession("master");
    const first = await generatePassword(
      session.cryptoKey,
      "example.com:alice",
      importedRule.id,
      { mode: "base62", maxLength: 24 },
      [importedRule]
    );
    const second = await generatePassword(
      session.cryptoKey,
      "example.com:alice",
      importedRule.id,
      { mode: "base62", maxLength: 24 },
      [importedRule]
    );

    expect(supportedImportedRuleAlgorithms()).toContain("pbkdf2-sha256");
    expect(ImportedRuleAlgorithmRegistry[manifest.algorithm]).toBeDefined();
    expect(manifest.iterations).toBe(320_000);
    expect(manifest.params).toEqual({
      iterations: 320_000,
      materialLabel: "material-v2",
      saltLabel: "salt-v2"
    });
    expect(importedRule.description).toContain("iterations=320000");
    expect(first.encodedPassword).toBe(second.encodedPassword);
  });

  it("兼容旧格式 iterations 并限制 PBKDF2 参数范围", () => {
    const manifest = parseImportedRuleManifest(
      JSON.stringify({
        id: "imported-legacy",
        name: "旧格式规则",
        algorithm: "pbkdf2-sha256",
        namespace: "legacy",
        iterations: 900_000
      })
    );

    expect(manifest.iterations).toBe(600_000);
    expect(manifest.params).toMatchObject({
      iterations: 600_000,
      materialLabel: "material",
      saltLabel: "salt"
    });
  });

  it("拒绝算法模板不支持的自定义参数", () => {
    expect(() =>
      parseImportedRuleManifest(
        JSON.stringify({
          id: "imported-unknown-param",
          name: "未知参数",
          algorithm: "hmac-sha256",
          params: {
            code: "fetch('/secret')"
          }
        })
      )
    ).toThrow("不支持参数 code");
  });

  it("创建导入规则时会重新校验持久化参数", () => {
    expect(() =>
      createImportedRule({
        id: "imported-stored",
        name: "已存规则",
        algorithm: "hmac-sha256",
        params: {
          code: "fetch('/secret')"
        }
      })
    ).toThrow("不支持参数 code");
  });

  it("拒绝非对象 params", () => {
    expect(() =>
      parseImportedRuleManifest(
        JSON.stringify({
          id: "imported-bad-params",
          name: "坏参数",
          algorithm: "hmac-sha256",
          params: "salt-prefix"
        })
      )
    ).toThrow("params 必须是对象");
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
