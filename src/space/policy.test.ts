import { describe, expect, it } from "vitest";
import { getEntryCapabilities } from "../ui/entryCapabilities";
import {
  canCreateEntry,
  canDeprecateEntry,
  canDeriveInSpace,
  canEditEntryMetadata,
  canEditRuleProfile,
  canManageMigration,
  canViewMemoryHint
} from "./policy";
import type { SpacePolicyInput } from "./types";

const entry = {
  id: "entry-1",
  spaceId: "default",
  encrypted_password: "encrypted",
  platform: "Example",
  description: "Primary",
  createdAt: 1,
  updatedAt: 1
};

const activeReady: SpacePolicyInput = {
  spaceStatus: "active",
  sessionAlive: true,
  ruleProfileInitialized: true,
  verificationStatus: "verified"
};

describe("Space policy 能力矩阵", () => {
  it("active 且会话存活、规则链已初始化、校验完成时允许创建 Entry", () => {
    expect(canCreateEntry(activeReady)).toBe(true);
    expect(canEditEntryMetadata(activeReady)).toBe(true);
    expect(canDeprecateEntry(activeReady)).toBe(true);
  });

  it("deprecated 默认禁止创建 Entry 和编辑 Rule", () => {
    const input = {
      ...activeReady,
      spaceStatus: "deprecated" as const
    };

    expect(canCreateEntry(input)).toBe(false);
    expect(canEditRuleProfile(input)).toBe(false);
    expect(canDeriveInSpace(input)).toBe(true);
  });

  it("archived 禁止写入和日常派生，但仍允许查看 memory hint", () => {
    const input = {
      ...activeReady,
      spaceStatus: "archived" as const
    };

    expect(canCreateEntry(input)).toBe(false);
    expect(canEditEntryMetadata(input)).toBe(false);
    expect(canDeriveInSpace(input)).toBe(false);
    expect(canViewMemoryHint(input)).toBe(true);
  });

  it("verification pending 时禁止写入，只允许查看待校验条目的 memory hint", () => {
    const input = {
      ...activeReady,
      verificationStatus: "pending" as const
    };

    expect(canCreateEntry(input)).toBe(false);
    expect(canEditRuleProfile(input)).toBe(false);
    expect(canViewMemoryHint({ ...input, isVerificationTarget: false })).toBe(
      false
    );
    expect(canViewMemoryHint({ ...input, isVerificationTarget: true })).toBe(
      true
    );
  });

  it("迁移写入要求 active、会话存活、校验完成且目标规则已初始化", () => {
    expect(canManageMigration(activeReady)).toBe(true);
    expect(
      canManageMigration({ ...activeReady, ruleProfileInitialized: false })
    ).toBe(false);
    expect(
      canManageMigration({ ...activeReady, verificationStatus: "pending" })
    ).toBe(false);
    expect(
      canManageMigration({ ...activeReady, spaceStatus: "deprecated" })
    ).toBe(false);
    expect(
      canManageMigration({ ...activeReady, spaceStatus: "archived" })
    ).toBe(false);
  });

  it("UI 能力聚合会给出编辑、解密和禁用原因", () => {
    expect(getEntryCapabilities(activeReady, entry).canEditEntry).toBe(true);
    expect(getEntryCapabilities(activeReady, entry).canDecrypt).toBe(true);

    const pending = {
      ...activeReady,
      verificationStatus: "pending" as const,
      isVerificationTarget: true
    };
    expect(getEntryCapabilities(pending, entry).canEditEntry).toBe(false);
    expect(getEntryCapabilities(pending, entry).canDecrypt).toBe(true);
    expect(getEntryCapabilities(pending, entry).disabledReason).toBe(
      "当前空间已有密码，请先完成空间校验后再编辑这条密码。"
    );

    const archived = {
      ...activeReady,
      spaceStatus: "archived" as const
    };
    expect(getEntryCapabilities(archived, entry).canDecrypt).toBe(false);
    expect(getEntryCapabilities(archived, entry).canViewMemoryHint).toBe(true);
  });
});
