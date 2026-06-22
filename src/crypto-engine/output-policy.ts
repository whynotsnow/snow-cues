import { bytesToBase64, utf8ToBytes } from "../lib/bytes";

export type PasswordOutputPolicy = {
  length: number;
  useUppercase: boolean;
  useLowercase: boolean;
  useDigits: boolean;
  useSymbols: boolean;
  minUppercase: number;
  minLowercase: number;
  minDigits: number;
  minSymbols: number;
  allowedSymbols: string;
  forbiddenChars: string;
};

export type PasswordOutputPresetId = "strong" | "alphanumeric" | "pin" | "long";

export type PasswordOutputPreset = {
  id: PasswordOutputPresetId;
  label: string;
  policy: PasswordOutputPolicy;
};

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

export const DEFAULT_ALLOWED_SYMBOLS = "!@#$%+=?";

export const PASSWORD_OUTPUT_PRESETS: PasswordOutputPreset[] = [
  {
    id: "strong",
    label: "通用强密码",
    policy: {
      length: 16,
      useUppercase: true,
      useLowercase: true,
      useDigits: true,
      useSymbols: true,
      minUppercase: 1,
      minLowercase: 1,
      minDigits: 1,
      minSymbols: 1,
      allowedSymbols: DEFAULT_ALLOWED_SYMBOLS,
      forbiddenChars: ""
    }
  },
  {
    id: "alphanumeric",
    label: "高兼容字母数字",
    policy: {
      length: 16,
      useUppercase: true,
      useLowercase: true,
      useDigits: true,
      useSymbols: false,
      minUppercase: 1,
      minLowercase: 1,
      minDigits: 1,
      minSymbols: 0,
      allowedSymbols: DEFAULT_ALLOWED_SYMBOLS,
      forbiddenChars: ""
    }
  },
  {
    id: "pin",
    label: "数字 PIN",
    policy: {
      length: 6,
      useUppercase: false,
      useLowercase: false,
      useDigits: true,
      useSymbols: false,
      minUppercase: 0,
      minLowercase: 0,
      minDigits: 6,
      minSymbols: 0,
      allowedSymbols: "",
      forbiddenChars: ""
    }
  },
  {
    id: "long",
    label: "较长强密码",
    policy: {
      length: 20,
      useUppercase: true,
      useLowercase: true,
      useDigits: true,
      useSymbols: true,
      minUppercase: 1,
      minLowercase: 1,
      minDigits: 1,
      minSymbols: 1,
      allowedSymbols: "!@#%?",
      forbiddenChars: ""
    }
  }
];

export const DEFAULT_PASSWORD_OUTPUT_POLICY = PASSWORD_OUTPUT_PRESETS[0].policy;

export async function adaptPasswordOutput(corePassword: string, policy: PasswordOutputPolicy): Promise<string> {
  if (!corePassword) {
    throw new Error("请先解密核心密码。");
  }

  const normalizedPolicy = normalizePasswordOutputPolicy(policy);
  const characterGroups = buildCharacterGroups(normalizedPolicy);
  const allCharacters = Object.values(characterGroups).join("");
  if (!allCharacters) {
    throw new Error("密码输出适配至少需要启用一种可用字符。");
  }

  const requiredGroups: Array<{ characters: string; count: number }> = [
    { characters: characterGroups.uppercase, count: normalizedPolicy.minUppercase },
    { characters: characterGroups.lowercase, count: normalizedPolicy.minLowercase },
    { characters: characterGroups.digits, count: normalizedPolicy.minDigits },
    { characters: characterGroups.symbols, count: normalizedPolicy.minSymbols }
  ].filter((group) => group.count > 0);

  const requiredCount = requiredGroups.reduce((total, group) => total + group.count, 0);
  if (requiredCount > normalizedPolicy.length) {
    throw new Error("密码输出适配的最小字符数量不能超过总长度。");
  }
  for (const group of requiredGroups) {
    if (!group.characters) {
      throw new Error("密码输出适配要求的字符类别没有可用字符。");
    }
  }

  const stream = await createByteStream(corePassword, normalizedPolicy, normalizedPolicy.length * 4 + 64);
  let cursor = 0;
  const nextByte = () => stream[cursor++ % stream.length];
  const output: string[] = [];

  for (const group of requiredGroups) {
    for (let index = 0; index < group.count; index += 1) {
      output.push(pickCharacter(group.characters, nextByte()));
    }
  }
  while (output.length < normalizedPolicy.length) {
    output.push(pickCharacter(allCharacters, nextByte()));
  }

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = nextByte() % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output.join("");
}

export function normalizePasswordOutputPolicy(policy: PasswordOutputPolicy): PasswordOutputPolicy {
  return {
    length: clampInteger(policy.length, 4, 128),
    useUppercase: Boolean(policy.useUppercase),
    useLowercase: Boolean(policy.useLowercase),
    useDigits: Boolean(policy.useDigits),
    useSymbols: Boolean(policy.useSymbols),
    minUppercase: clampInteger(policy.minUppercase, 0, 128),
    minLowercase: clampInteger(policy.minLowercase, 0, 128),
    minDigits: clampInteger(policy.minDigits, 0, 128),
    minSymbols: clampInteger(policy.minSymbols, 0, 128),
    allowedSymbols: uniqueCharacters(policy.allowedSymbols),
    forbiddenChars: uniqueCharacters(policy.forbiddenChars)
  };
}

function buildCharacterGroups(policy: PasswordOutputPolicy) {
  const forbidden = new Set([...policy.forbiddenChars]);
  return {
    uppercase: policy.useUppercase ? removeForbidden(UPPERCASE, forbidden) : "",
    lowercase: policy.useLowercase ? removeForbidden(LOWERCASE, forbidden) : "",
    digits: policy.useDigits ? removeForbidden(DIGITS, forbidden) : "",
    symbols: policy.useSymbols ? removeForbidden(policy.allowedSymbols, forbidden) : ""
  };
}

function removeForbidden(characters: string, forbidden: Set<string>): string {
  return [...characters].filter((char) => !forbidden.has(char)).join("");
}

function uniqueCharacters(characters: string): string {
  return [...new Set(characters ?? "")].join("");
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.floor(value) : min;
  return Math.min(max, Math.max(min, integer));
}

function pickCharacter(characters: string, byte: number): string {
  return characters[byte % characters.length];
}

async function createByteStream(corePassword: string, policy: PasswordOutputPolicy, byteLength: number): Promise<Uint8Array> {
  const chunks: number[] = [];
  let counter = 0;
  while (chunks.length < byteLength) {
    const material = JSON.stringify({
      purpose: "snow-cues:v1.0:password-output-adapter",
      counter,
      corePassword,
      policy
    });
    const digest = await crypto.subtle.digest("SHA-256", utf8ToBytes(material));
    chunks.push(...new Uint8Array(digest));
    counter += 1;
  }
  return new Uint8Array(chunks.slice(0, byteLength));
}

export function serializePasswordOutputPolicy(policy: PasswordOutputPolicy): string {
  return bytesToBase64(utf8ToBytes(JSON.stringify(normalizePasswordOutputPolicy(policy))));
}
