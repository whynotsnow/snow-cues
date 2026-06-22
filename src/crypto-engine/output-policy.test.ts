import { describe, expect, it } from "vitest";
import {
  adaptPasswordOutput,
  DEFAULT_PASSWORD_OUTPUT_POLICY,
  type PasswordOutputPolicy
} from "./output-policy";

function hasAny(password: string, characters: string) {
  return [...password].some((char) => characters.includes(char));
}

describe("密码输出适配", () => {
  it("同一核心密码和同一策略会生成稳定输出", async () => {
    const first = await adaptPasswordOutput(
      "core-password",
      DEFAULT_PASSWORD_OUTPUT_POLICY
    );
    const second = await adaptPasswordOutput(
      "core-password",
      DEFAULT_PASSWORD_OUTPUT_POLICY
    );

    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });

  it("不同策略会生成不同输出", async () => {
    const first = await adaptPasswordOutput(
      "core-password",
      DEFAULT_PASSWORD_OUTPUT_POLICY
    );
    const second = await adaptPasswordOutput("core-password", {
      ...DEFAULT_PASSWORD_OUTPUT_POLICY,
      length: 20,
      useSymbols: false,
      minSymbols: 0
    });

    expect(first).not.toBe(second);
  });

  it("输出满足字符类别和禁用字符要求", async () => {
    const policy: PasswordOutputPolicy = {
      length: 18,
      useUppercase: true,
      useLowercase: true,
      useDigits: true,
      useSymbols: true,
      minUppercase: 2,
      minLowercase: 2,
      minDigits: 2,
      minSymbols: 2,
      allowedSymbols: "!@#",
      forbiddenChars: "O0l!"
    };

    const password = await adaptPasswordOutput("core-password", policy);

    expect(password).toHaveLength(18);
    expect(hasAny(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe(true);
    expect(hasAny(password, "abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(hasAny(password, "0123456789")).toBe(true);
    expect(hasAny(password, "@#")).toBe(true);
    expect(password).not.toMatch(/[O0l!]/);
  });

  it("不可满足的策略会抛出中文错误", async () => {
    await expect(
      adaptPasswordOutput("core-password", {
        ...DEFAULT_PASSWORD_OUTPUT_POLICY,
        length: 4,
        minUppercase: 2,
        minLowercase: 2,
        minDigits: 2,
        minSymbols: 2
      })
    ).rejects.toThrow("最小字符数量不能超过总长度");
  });
});
