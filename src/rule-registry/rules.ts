import { bytesToBase64, utf8ToBytes } from "../lib/bytes";
import {
  hmacSha256,
  ImportedRuleAlgorithmRegistry,
  isImportedRuleAlgorithmId,
  supportedImportedRuleAlgorithms,
  type CryptoRule,
  type ImportedRuleAlgorithmId,
  type ImportedRuleParams
} from "./imported-rule-algorithms";

export type { CryptoRule, ImportedRuleAlgorithmId };

export type RuleDefinition = {
  id: string;
  label: string;
  available: boolean;
  origin: "系统内置" | "导入规则";
  description: string;
  execute: CryptoRule;
};

export type RuleId = "v1-hmac" | "v2-pbkdf2" | "v3-argon2";
export type ActiveRuleId = RuleId | string;

export type ImportedRuleManifest = {
  id: string;
  name: string;
  algorithm: ImportedRuleAlgorithmId;
  namespace?: string;
  iterations?: number;
  params?: ImportedRuleParams;
};

async function pbkdf2Rule(masterKey: CryptoKey, salt: string): Promise<string> {
  const hmacMaterial = await hmacSha256(
    masterKey,
    `snow-cues:v1.0:v2-pbkdf2:material:${salt}`
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(hmacMaterial),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: utf8ToBytes(`snow-cues:v1.0:v2-pbkdf2:salt:${salt}`),
      iterations: 210_000
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function unavailableArgon2(): Promise<string> {
  throw new Error("v3-argon2 已预留给未来的 wasm 实现。");
}

export const RuleRegistry = Object.freeze({
  "v1-hmac": Object.freeze({
    id: "v1-hmac",
    label: "稳定 HMAC",
    available: true,
    origin: "系统内置",
    description: "使用 HMAC-SHA256 直接基于会话 key 与关键密钥生成密码材料。",
    execute: hmacSha256
  }),
  "v2-pbkdf2": Object.freeze({
    id: "v2-pbkdf2",
    label: "增强 PBKDF2",
    available: true,
    origin: "系统内置",
    description: "先用 HMAC 生成材料，再通过 PBKDF2-SHA256 增强计算成本。",
    execute: pbkdf2Rule
  }),
  "v3-argon2": Object.freeze({
    id: "v3-argon2",
    label: "预留 Argon2",
    available: false,
    origin: "系统内置",
    description: "预留给未来 wasm-backed Argon2 实现，当前不会生效。",
    execute: unavailableArgon2
  })
} satisfies Record<RuleId, RuleDefinition>);

export function getRule(
  ruleId: ActiveRuleId,
  importedRules: RuleDefinition[] = []
): RuleDefinition {
  const rule =
    RuleRegistry[ruleId as RuleId] ??
    importedRules.find((item) => item.id === ruleId);
  if (!rule || !rule.available) {
    throw new Error(`规则不可用：${ruleId}`);
  }
  return rule;
}

export const availableRules = Object.values(RuleRegistry).filter(
  (rule) => rule.available
);

export function parseImportedRuleManifest(input: string): ImportedRuleManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("导入规则必须是 JSON。");
  }

  if (!isRecord(parsed)) {
    throw new Error("导入规则格式无效。");
  }

  const id = normalizeImportedId(parsed.id);
  const name = normalizeImportedName(parsed.name);
  const algorithm = parsed.algorithm;
  if (!isImportedRuleAlgorithmId(algorithm)) {
    throw new Error(
      `导入规则只允许已注册算法：${supportedImportedRuleAlgorithms().join("、")}。`
    );
  }

  const namespace =
    typeof parsed.namespace === "string" && parsed.namespace.trim()
      ? parsed.namespace.trim()
      : id;
  const algorithmDefinition = ImportedRuleAlgorithmRegistry[algorithm];
  const legacyIterations =
    typeof parsed.iterations === "number" && Number.isInteger(parsed.iterations)
      ? parsed.iterations
      : undefined;
  const params: ImportedRuleParams = algorithmDefinition.normalizeParams({
    namespace,
    legacyIterations,
    params: normalizeParamsInput(parsed.params)
  });
  const iterations =
    typeof params.iterations === "number" ? params.iterations : undefined;

  return {
    id,
    name,
    algorithm,
    namespace,
    iterations,
    params
  };
}

export function createImportedRule(
  manifest: ImportedRuleManifest
): RuleDefinition {
  if (!isImportedRuleAlgorithmId(manifest.algorithm)) {
    throw new Error(`导入规则算法未注册：${manifest.algorithm}`);
  }
  const namespace = manifest.namespace ?? manifest.id;
  const algorithmDefinition = ImportedRuleAlgorithmRegistry[manifest.algorithm];
  const params: ImportedRuleParams = algorithmDefinition.normalizeParams({
    namespace,
    legacyIterations: manifest.iterations,
    params: manifest.params
  });
  const normalizedManifest = {
    ...manifest,
    namespace,
    params
  };

  return {
    id: manifest.id,
    label: manifest.name,
    available: true,
    origin: "导入规则",
    description: algorithmDefinition.description(normalizedManifest),
    execute: algorithmDefinition.createExecute(normalizedManifest)
  };
}

function normalizeImportedId(value: unknown): string {
  if (typeof value !== "string" || !/^imported-[a-z0-9-]{3,40}$/.test(value)) {
    throw new Error("导入规则 id 必须形如 imported-example。");
  }
  if (value in RuleRegistry) {
    throw new Error("导入规则不能覆盖系统内置规则。");
  }
  return value;
}

function normalizeImportedName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("导入规则需要 name。");
  }
  const name = value.trim();
  if (name.length < 2 || name.length > 32) {
    throw new Error("导入规则名称长度需要在 2 到 32 个字符之间。");
  }
  return name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeParamsInput(
  value: unknown
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error("导入规则 params 必须是对象。");
  }
  return value;
}
