import { bytesToBase64, bytesToUtf8, concatBytes, utf8ToBytes } from "../lib/bytes";
import { getRule, type ActiveRuleId, type RuleDefinition } from "../rule-registry/rules";
import { encodePasswordMaterial, type EncodingPolicy } from "./encoding";

export const DEFAULT_DETACHED_RULE_CHAIN: ActiveRuleId[] = ["v1-hmac", "v2-pbkdf2"];

export type GeneratedPassword = {
  encodedPassword: string;
  rawRuleMaterial: string;
  appliedRuleIds: ActiveRuleId[];
};

export async function generatePassword(
  masterKey: CryptoKey,
  entrySecret: string,
  ruleId: ActiveRuleId,
  encodingPolicy: EncodingPolicy,
  importedRules: RuleDefinition[] = []
): Promise<GeneratedPassword> {
  return generatePasswordWithRuleChain(masterKey, entrySecret, [ruleId], encodingPolicy, importedRules);
}

export async function generatePasswordWithRuleChain(
  masterKey: CryptoKey,
  entrySecret: string,
  ruleIds: ActiveRuleId[],
  encodingPolicy: EncodingPolicy,
  importedRules: RuleDefinition[] = []
): Promise<GeneratedPassword> {
  if (!entrySecret.trim()) {
    throw new Error("请输入关键密钥。");
  }
  if (ruleIds.length === 0) {
    throw new Error("请至少选择一个生效规则。");
  }

  let rawRuleMaterial = entrySecret;
  for (const ruleId of ruleIds) {
    const rule = getRule(ruleId, importedRules);
    rawRuleMaterial = await rule.execute(masterKey, rawRuleMaterial);
  }
  return {
    appliedRuleIds: ruleIds,
    rawRuleMaterial,
    encodedPassword: encodePasswordMaterial(rawRuleMaterial, encodingPolicy)
  };
}

export async function generateDetachedPassword(
  derivationKey: string,
  encodingPolicy: EncodingPolicy
): Promise<GeneratedPassword> {
  if (!derivationKey.trim()) {
    throw new Error("请输入派生密钥。");
  }

  const detachedKey = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(`snow-cues:v1.0:detached-password:${derivationKey}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return generatePasswordWithRuleChain(
    detachedKey,
    derivationKey,
    DEFAULT_DETACHED_RULE_CHAIN,
    encodingPolicy
  );
}

export async function encryptPassword(storageKey: CryptoKey, password: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    storageKey,
    utf8ToBytes(password)
  );

  return bytesToBase64(concatBytes(iv, new Uint8Array(ciphertext)));
}

export async function deriveRuntimeStorageKey(masterKey: CryptoKey, entrySecret: string): Promise<CryptoKey> {
  if (!entrySecret.trim()) {
    throw new Error("请输入用于加密或解密的关键密钥。");
  }

  const keyMaterial = await crypto.subtle.sign(
    "HMAC",
    masterKey,
    utf8ToBytes(`snow-cues:v1.0:storage-key:${entrySecret}`)
  );

  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function decryptPassword(storageKey: CryptoKey, encryptedPassword: string): Promise<string> {
  const sealedBytes: Uint8Array<ArrayBuffer> = Uint8Array.from(atob(encryptedPassword), (char) =>
    char.charCodeAt(0)
  );
  if (sealedBytes.length <= 12) {
    throw new Error("加密密码数据无效。");
  }

  const iv = sealedBytes.slice(0, 12);
  const ciphertext = sealedBytes.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    storageKey,
    ciphertext
  );

  return bytesToUtf8(new Uint8Array(plaintext));
}
