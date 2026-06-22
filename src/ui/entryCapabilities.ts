import {
  canDeprecateEntry,
  canDeriveInSpace,
  canEditEntryDescription,
  canEditEntryMetadata,
  canEditMemoryHint,
  canViewMemoryHint
} from "../space/policy";
import type { PasswordEntry } from "../storage-data";
import type { SpacePolicyInput } from "../space/types";

export type EntryCapabilities = {
  canDecrypt: boolean;
  canViewMemoryHint: boolean;
  canEditEntry: boolean;
  canEditEntryMetadata: boolean;
  canEditEntryDescription: boolean;
  canEditMemoryHint: boolean;
  canDeprecate: boolean;
  disabledReason: string;
  visible: boolean;
  hiddenReason: string;
};

export function getEntryCapabilities(
  policyInput: SpacePolicyInput,
  entry: PasswordEntry
): EntryCapabilities {
  const canDecrypt = canDeriveInSpace(policyInput);
  const canReadHint = canViewMemoryHint(policyInput);
  const canEditMetadata = canEditEntryMetadata(policyInput);
  const canEditDescription = canEditEntryDescription(policyInput);
  const canEditHint = canEditMemoryHint(policyInput);
  const canDeprecateCurrentEntry = canDeprecateEntry(policyInput);
  const disabledReason = getDisabledReason(policyInput, entry);

  return {
    canDecrypt,
    canViewMemoryHint: canReadHint,
    canEditEntry: canEditMetadata || canEditDescription || canEditHint,
    canEditEntryMetadata: canEditMetadata,
    canEditEntryDescription: canEditDescription,
    canEditMemoryHint: canEditHint,
    canDeprecate: canDeprecateCurrentEntry,
    disabledReason,
    visible: true,
    hiddenReason: ""
  };
}

function getDisabledReason(
  policyInput: SpacePolicyInput,
  entry: PasswordEntry
) {
  if (!policyInput.sessionAlive) {
    return policyInput.verificationStatus === "pending"
      ? "请先输入空间主密码并完成空间校验。"
      : "请先输入空间主密码。";
  }
  if (policyInput.verificationStatus === "pending") {
    return "当前空间已有密码，请先完成空间校验后再编辑这条密码。";
  }
  if (policyInput.spaceStatus === "deprecated") {
    return "历史空间只保留查看和解密能力。";
  }
  if (policyInput.spaceStatus === "archived") {
    return "归档空间只保留受限查看能力。";
  }
  if (entry.deprecatedAt) {
    return "已废弃密码不能修改平台名称。";
  }
  return "";
}
