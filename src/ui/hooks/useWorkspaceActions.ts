import { useState } from "react";
import {
  clearPasswordEntriesBySpace,
  clearSpaceProfile,
  deleteSpaceData,
  resetLocalData,
  type PasswordEntry
} from "../../storage-engine/storage-engine";
import { canCreateEntry, canRunTestCleanup } from "../../space/policy";
import type { SpacePolicyInput } from "../../space/types";
import { normalizeSpaceId, type AppPage, type UiState } from "../appTypes";

type UseWorkspaceActionsInput = {
  basePolicyInput: SpacePolicyInput;
  currentSpaceId: string;
  outsideSpace: boolean;
  ruleProfileConfirmed: boolean;
  verificationPending: boolean;
  leaveSpace: (nextState?: UiState) => void;
  refreshSpaceIndex: () => Promise<void>;
  resetRuleProfile: () => void;
  setActivePage: (page: AppPage) => void;
  setEntries: (entries: PasswordEntry[]) => void;
  setError: (message: string) => void;
  setShowCreateForm: (updater: boolean | ((value: boolean) => boolean)) => void;
  setStatus: (message: string) => void;
  setVisibleEntryId: (entryId: string | null) => void;
  setVisiblePassword: (password: string) => void;
};

export function useWorkspaceActions({
  basePolicyInput,
  currentSpaceId,
  outsideSpace,
  ruleProfileConfirmed,
  verificationPending,
  leaveSpace,
  refreshSpaceIndex,
  resetRuleProfile,
  setActivePage,
  setEntries,
  setError,
  setShowCreateForm,
  setStatus,
  setVisibleEntryId,
  setVisiblePassword
}: UseWorkspaceActionsInput) {
  const createEntryAllowed = canCreateEntry({
    ...basePolicyInput,
    sessionAlive: true
  });
  const testCleanupAllowed = canRunTestCleanup(basePolicyInput);
  const [testToolSpaceId, setTestToolSpaceId] = useState("");

  function ensurePolicyAllowed(allowed: boolean, fallbackMessage = "当前空间状态不允许执行此操作。") {
    if (!allowed) {
      throw new Error(verificationPending ? "当前空间已有密码，请先完成空间校验后再进行写入或修改操作。" : fallbackMessage);
    }
  }

  function handleCreateEntryClick() {
    if (verificationPending) {
      setShowCreateForm(false);
      setStatus("当前空间已有密码，请先完成空间校验后再进行写入或修改操作。");
      return;
    }
    if (!ruleProfileConfirmed) {
      setActivePage("rules");
      setShowCreateForm(false);
      setStatus("新建密码前需要先初始化存储空间规则链。");
      return;
    }
    if (!createEntryAllowed) {
      setShowCreateForm(false);
      setStatus(verificationPending ? "当前空间已有密码，请先完成空间校验后再进行写入或修改操作。" : "当前空间状态不允许新建密码。");
      return;
    }
    setShowCreateForm((value) => !value);
  }

  async function handleClearPasswords() {
    setError("");
    setStatus("");
    try {
      ensurePolicyAllowed(testCleanupAllowed, "当前空间不能执行测试清理操作。");
      await clearPasswordEntriesBySpace(currentSpaceId);
      setEntries([]);
      setVisibleEntryId(null);
      setVisiblePassword("");
      setStatus("测试操作已清空已存储密码。");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "无法清空密码数据。");
    }
  }

  async function handleClearProfile() {
    setError("");
    setStatus("");
    try {
      ensurePolicyAllowed(testCleanupAllowed, "当前空间不能执行测试清理操作。");
      await clearSpaceProfile(currentSpaceId);
      resetRuleProfile();
      setShowCreateForm(false);
      setStatus("测试操作已重置当前空间规则链配置。");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "无法重置规则链配置。");
    }
  }

  async function handleResetLocalData() {
    setError("");
    setStatus("");
    try {
      if (!window.confirm("测试操作会清空全部 IndexedDB 本地数据，确定继续吗？")) {
        return;
      }
      await resetLocalData();
      setEntries([]);
      resetRuleProfile();
      setShowCreateForm(false);
      setVisibleEntryId(null);
      setVisiblePassword("");
      setTestToolSpaceId("");
      await refreshSpaceIndex();
      if (!outsideSpace) {
        leaveSpace("LEFT_SPACE");
      }
      setStatus("测试操作已清空全部本地数据。");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "无法清空本地数据。");
    }
  }

  async function handleDeleteTestSpace() {
    setError("");
    setStatus("");
    try {
      const targetSpaceId = normalizeSpaceId(testToolSpaceId);
      if (!targetSpaceId) {
        throw new Error("请输入要删除的存储空间 ID。");
      }
      if (!window.confirm(`测试操作会删除存储空间 ${targetSpaceId} 及其相关本地数据，确定继续吗？`)) {
        return;
      }
      await deleteSpaceData(targetSpaceId);
      await refreshSpaceIndex();
      setTestToolSpaceId("");
      if (targetSpaceId === currentSpaceId) {
        leaveSpace("LEFT_SPACE");
      }
      setStatus(`测试操作已删除存储空间 ${targetSpaceId}。`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "无法删除存储空间。");
    }
  }

  return {
    createEntryAllowed,
    testCleanupAllowed,
    testToolSpaceId,
    setTestToolSpaceId,
    handleCreateEntryClick,
    handleClearPasswords,
    handleClearProfile,
    handleResetLocalData,
    handleDeleteTestSpace
  };
}
