import { bytesToBase64, utf8ToBytes } from "../lib/bytes";

export type CryptoRule = (
  masterKey: CryptoKey,
  salt: string
) => Promise<string>;

export type ImportedRuleAlgorithmId = "hmac-sha256" | "pbkdf2-sha256";

export type ImportedRuleParams = Record<string, number | string>;

export type ImportedRuleAlgorithmManifest = {
  id: string;
  name: string;
  algorithm: ImportedRuleAlgorithmId;
  namespace: string;
  params: ImportedRuleParams;
};

type ImportedRuleAlgorithmDefinition = {
  normalizeParams: (input: {
    namespace: string;
    legacyIterations?: number;
    params?: Record<string, unknown>;
  }) => ImportedRuleParams;
  description: (manifest: ImportedRuleAlgorithmManifest) => string;
  createExecute: (manifest: ImportedRuleAlgorithmManifest) => CryptoRule;
};

const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 600_000;
const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const CONFIG_LABEL_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function hmacSha256(
  masterKey: CryptoKey,
  salt: string
): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    masterKey,
    utf8ToBytes(salt)
  );
  return bytesToBase64(new Uint8Array(signature));
}

export const ImportedRuleAlgorithmRegistry = Object.freeze({
  "hmac-sha256": Object.freeze({
    normalizeParams: ({ namespace, params }) => {
      assertKnownParams(params, ["saltPrefix"], "hmac-sha256");
      return {
        saltPrefix: normalizeConfigLabel(
          params?.saltPrefix,
          namespace,
          "saltPrefix"
        )
      };
    },
    description: (manifest) =>
      `声明式 HMAC-SHA256 规则，namespace=${manifest.namespace}，saltPrefix=${manifest.params.saltPrefix}。`,
    createExecute: (manifest) => (masterKey, salt) =>
      hmacSha256(masterKey, `${manifest.params.saltPrefix}:${salt}`)
  }),
  "pbkdf2-sha256": Object.freeze({
    normalizeParams: ({ legacyIterations, params }) => {
      assertKnownParams(
        params,
        ["iterations", "materialLabel", "saltLabel"],
        "pbkdf2-sha256"
      );
      return {
        iterations: normalizeIterations(params?.iterations ?? legacyIterations),
        materialLabel: normalizeConfigLabel(
          params?.materialLabel,
          "material",
          "materialLabel"
        ),
        saltLabel: normalizeConfigLabel(params?.saltLabel, "salt", "saltLabel")
      };
    },
    description: (manifest) =>
      `声明式 PBKDF2-SHA256 规则，iterations=${manifest.params.iterations}，namespace=${manifest.namespace}。`,
    createExecute: (manifest) => async (masterKey, salt) => {
      const hmacMaterial = await hmacSha256(
        masterKey,
        `${manifest.namespace}:${manifest.params.materialLabel}:${salt}`
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
          salt: utf8ToBytes(
            `${manifest.namespace}:${manifest.params.saltLabel}:${salt}`
          ),
          iterations: manifest.params.iterations as number
        },
        keyMaterial,
        256
      );
      return bytesToBase64(new Uint8Array(bits));
    }
  })
} satisfies Record<ImportedRuleAlgorithmId, ImportedRuleAlgorithmDefinition>);

export function isImportedRuleAlgorithmId(
  value: unknown
): value is ImportedRuleAlgorithmId {
  return typeof value === "string" && value in ImportedRuleAlgorithmRegistry;
}

export function supportedImportedRuleAlgorithms(): ImportedRuleAlgorithmId[] {
  return Object.keys(
    ImportedRuleAlgorithmRegistry
  ) as ImportedRuleAlgorithmId[];
}

function assertKnownParams(
  params: Record<string, unknown> | undefined,
  allowedKeys: string[],
  algorithm: ImportedRuleAlgorithmId
) {
  if (!params) {
    return;
  }
  for (const key of Object.keys(params)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`算法 ${algorithm} 不支持参数 ${key}。`);
    }
  }
}

function normalizeIterations(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_PBKDF2_ITERATIONS;
  }
  return Math.min(
    Math.max(value, MIN_PBKDF2_ITERATIONS),
    MAX_PBKDF2_ITERATIONS
  );
}

function normalizeConfigLabel(
  value: unknown,
  fallback: string,
  fieldName: string
): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!CONFIG_LABEL_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} 只能包含小写字母、数字和连字符。`);
  }
  return normalized;
}
