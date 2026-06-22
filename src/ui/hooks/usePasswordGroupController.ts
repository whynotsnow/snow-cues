import { useCallback, useState } from "react";
import {
  createPasswordGroup,
  deletePasswordGroup,
  listPasswordGroupsBySpace,
  saveSpace,
  updatePasswordGroup,
  type PasswordGroup,
  type SpaceRecord
} from "../../storage-engine/storage-engine";
import { DEFAULT_PASSWORD_OUTPUT_POLICY, type PasswordOutputPolicy, type PasswordOutputPresetId } from "../../crypto-engine/output-policy";
import { canEditRuleProfile } from "../../space/policy";
import type { SpacePolicyInput } from "../../space/types";
import type { Session } from "../../session-manager/session-manager";
import type { UiState } from "../appTypes";

export type PasswordGroupDraft = {
  name: string;
  description: string;
  presetId: PasswordOutputPresetId | "custom";
  outputPolicy: PasswordOutputPolicy;
};

type UsePasswordGroupControllerInput = {
  basePolicyInput: SpacePolicyInput;
  currentSpaceId: string;
  currentSpaceStatus: SpaceRecord["status"];
  setCurrentSpace: (space: SpaceRecord) => void;
  setCurrentSpaceIsTemporary: (temporary: boolean) => void;
  setError: (message: string) => void;
  setStatus: (message: string) => void;
  setUiState: (state: UiState) => void;
  ensureLiveSession: (masterPassword?: string) => Promise<Session>;
  withLiveSession: <T>(operation: (liveSession: Session) => Promise<T>) => Promise<T>;
};

export function usePasswordGroupController({
  basePolicyInput,
  currentSpaceId,
  currentSpaceStatus,
  setCurrentSpace,
  setCurrentSpaceIsTemporary,
  setError,
  setStatus,
  setUiState,
  ensureLiveSession,
  withLiveSession
}: UsePasswordGroupControllerInput) {
  const [passwordGroups, setPasswordGroups] = useState<PasswordGroup[]>([]);
  const [groupDraft, setGroupDraft] = useState<PasswordGroupDraft>(createEmptyGroupDraft());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupDraft, setEditingGroupDraft] = useState<PasswordGroupDraft | null>(null);
  const [groupSavingId, setGroupSavingId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const groupManagementAllowed = canEditRuleProfile({
    ...basePolicyInput,
    sessionAlive: true
  });

  const refreshPasswordGroups = useCallback(async () => {
    if (!currentSpaceId) {
      setPasswordGroups([]);
      return;
    }
    try {
      setPasswordGroups(await listPasswordGroupsBySpace(currentSpaceId));
    } catch (refreshError) {
      setPasswordGroups([]);
      setError(refreshError instanceof Error ? refreshError.message : "无法读取密码组输出适配。");
    }
  }, [currentSpaceId, setError]);

  function ensureGroupManagementAllowed() {
    if (!groupManagementAllowed) {
      throw new Error("当前空间状态不允许管理密码组输出适配。");
    }
  }

  async function handleCreatePasswordGroup(masterPassword?: string) {
    setError("");
    setStatus("");
    setCreatingGroup(true);
    try {
      await ensureLiveSession(masterPassword);
      ensureGroupManagementAllowed();
      if (!groupDraft.name.trim()) {
        throw new Error("请输入密码组名称。");
      }
      const savedSpace = await saveSpace({
        spaceId: currentSpaceId,
        status: currentSpaceStatus
      });
      await createPasswordGroup({
        spaceId: currentSpaceId,
        name: groupDraft.name,
        description: groupDraft.description,
        outputPolicy: groupDraft.outputPolicy
      });
      setCurrentSpace(savedSpace);
      setCurrentSpaceIsTemporary(false);
      setUiState("ACTIVE");
      setGroupDraft(createEmptyGroupDraft());
      await refreshPasswordGroups();
      setStatus("密码组已创建。");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "无法创建密码组。");
    } finally {
      setCreatingGroup(false);
    }
  }

  function handleStartEditPasswordGroup(group: PasswordGroup) {
    setError("");
    setStatus("");
    setEditingGroupId(group.id);
    setEditingGroupDraft({
      name: group.name,
      description: group.description ?? "",
      presetId: "custom",
      outputPolicy: group.outputPolicy
    });
  }

  function handleCancelEditPasswordGroup() {
    setError("");
    setStatus("");
    setEditingGroupId(null);
    setEditingGroupDraft(null);
    setGroupSavingId(null);
  }

  async function handleSavePasswordGroup(groupId: string, draft = editingGroupDraft) {
    setError("");
    setStatus("");
    try {
      await withLiveSession(async () => {
        ensureGroupManagementAllowed();
        if (!draft?.name.trim()) {
          throw new Error("请输入密码组名称。");
        }
        setGroupSavingId(groupId);
        await updatePasswordGroup(groupId, {
          name: draft.name,
          description: draft.description,
          outputPolicy: draft.outputPolicy
        });
        setEditingGroupId(null);
        setEditingGroupDraft(null);
        await refreshPasswordGroups();
        setStatus("密码组输出适配已保存。");
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "无法保存密码组。");
    } finally {
      setGroupSavingId(null);
    }
  }

  async function handleDeletePasswordGroup(groupId: string) {
    setError("");
    setStatus("");
    try {
      await withLiveSession(async () => {
        ensureGroupManagementAllowed();
        await deletePasswordGroup(groupId);
        await refreshPasswordGroups();
        setStatus("密码组已删除。");
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "无法删除密码组。");
    }
  }

  async function handleSaveOutputPolicyToGroup(groupId: string, outputPolicy: PasswordOutputPolicy) {
    const group = passwordGroups.find((item) => item.id === groupId);
    if (!group) {
      setError("未找到密码组。");
      return;
    }
    await handleSavePasswordGroup(groupId, {
      name: group.name,
      description: group.description ?? "",
      presetId: "custom",
      outputPolicy
    });
  }

  return {
    passwordGroups,
    setPasswordGroups,
    groupDraft,
    setGroupDraft,
    editingGroupId,
    editingGroupDraft,
    setEditingGroupDraft,
    groupSavingId,
    creatingGroup,
    groupManagementAllowed,
    refreshPasswordGroups,
    handleCreatePasswordGroup,
    handleStartEditPasswordGroup,
    handleCancelEditPasswordGroup,
    handleSavePasswordGroup,
    handleDeletePasswordGroup,
    handleSaveOutputPolicyToGroup
  };
}

function createEmptyGroupDraft(): PasswordGroupDraft {
  return {
    name: "",
    description: "",
    presetId: "strong",
    outputPolicy: DEFAULT_PASSWORD_OUTPUT_POLICY
  };
}
