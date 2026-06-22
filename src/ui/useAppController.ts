import { useCallback, useEffect, useMemo, useState } from "react";
import { parseImportedRuleManifest, type ActiveRuleId } from "../rule-registry/rules";
import {
  createSession,
  isSessionExpired,
  touchSession,
  type Session
} from "../session-manager/session-manager";
import {
  listSpaceProfile,
  type PasswordEntry,
  type SpaceRecord
} from "../storage-engine/storage-engine";
import type { SpaceRuntimeVerificationStatus } from "../space/types";
import { useEntryRuntimeState } from "./hooks/useEntryRuntimeState";
import { useDetachedPasswordController } from "./hooks/useDetachedPasswordController";
import { usePasswordEntryController } from "./hooks/usePasswordEntryController";
import { usePasswordGroupController } from "./hooks/usePasswordGroupController";
import { useRuleProfileController } from "./hooks/useRuleProfileController";
import { useSpaceManagementController } from "./hooks/useSpaceManagementController";
import { useSpaceAccessController } from "./hooks/useSpaceAccessController";
import { useSpaceIndexController } from "./hooks/useSpaceIndexController";
import { useWorkspaceActions } from "./hooks/useWorkspaceActions";
import { useSystemNotifications } from "./notifications/useSystemNotifications";
import { spaceStatusLabels, type AppPage, type UiState } from "./appTypes";

export function useAppController() {
  const [uiState, setUiState] = useState<UiState>("OUT_OF_SPACE");
  const [session, setSession] = useState<Session | null>(null);
  const [currentSpaceId, setCurrentSpaceId] = useState("");
  const [currentSpace, setCurrentSpace] = useState<SpaceRecord | null>(null);
  const [currentSpaceIsTemporary, setCurrentSpaceIsTemporary] = useState(false);
  const [loginVerificationEntryId, setLoginVerificationEntryId] = useState<string | null>(null);
  const [ruleProfileConfirmed, setRuleProfileConfirmed] = useState(false);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const entryRuntime = useEntryRuntimeState();
  const [activePage, setActivePage] = useState<AppPage>("passwords");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [creatingPassword, setCreatingPassword] = useState(false);
  const [appliedMigrationDraftBatchId, setAppliedMigrationDraftBatchId] = useState("");
  const [autoReadyingMigrationBatchId, setAutoReadyingMigrationBatchId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const systemNotifications = useSystemNotifications();
  const { notifySystem } = systemNotifications;

  const sessionAlive = Boolean(session && !isSessionExpired(session));
  const outsideSpace = uiState === "OUT_OF_SPACE" || uiState === "LEFT_SPACE";
  const verificationPending = Boolean(loginVerificationEntryId);
  const verificationStatus: SpaceRuntimeVerificationStatus = entries.length === 0
    ? "not_required"
    : loginVerificationEntryId
      ? "pending"
      : "verified";
  const currentSpaceStatus = currentSpace?.status ?? "active";
  // 离开空间或会话过期时统一清理内存中的敏感运行时状态。
  const clearSensitiveState = useCallback(() => {
    entryRuntime.clearEntryRuntimeState();
    setLoginVerificationEntryId(null);
  }, [entryRuntime]);
  const handleSelectLoginVerificationEntry = useCallback((entryId: string) => {
    setLoginVerificationEntryId(entryId);
    entryRuntime.setDecryptingEntryId(entryId);
    entryRuntime.setVisibleEntryId(null);
    entryRuntime.setVisiblePassword("");
    entryRuntime.setDecryptSpaceMasterPasswords({});
    entryRuntime.setDecryptEntrySecrets({});
    setStatus("");
    setError("");
  }, [entryRuntime]);
  const ensureLiveSession = useCallback(async (masterPassword?: string): Promise<Session> => {
    if (session && !isSessionExpired(session)) {
      const liveSession = touchSession(session);
      setSession(liveSession);
      return liveSession;
    }
    if (session && isSessionExpired(session)) {
      setSession(null);
      clearSensitiveState();
      setEntries([]);
      setCurrentSpaceId("");
      setCurrentSpace(null);
      setCurrentSpaceIsTemporary(false);
      setActivePage("space");
      setShowCreateForm(false);
      setRuleProfileConfirmed(false);
      setUiState("LEFT_SPACE");
      setStatus("已离开存储空间。");
      notifySystem({
        tone: "warning",
        title: "空间会话已过期",
        body: "当前空间会话已结束，请重新进入后继续操作。"
      });
      throw new Error("空间会话已过期，请重新进入。");
    }
    const nextSession = await createSession(masterPassword ?? "");
    setSession(nextSession);
    return nextSession;
  }, [clearSensitiveState, notifySystem, session]);
  // 应用级策略输入集中在这里生成，子 hook 只消费结果，避免各自重复推导门禁状态。
  const basePolicyInput = useMemo(
    () => ({
      spaceStatus: currentSpaceStatus,
      sessionAlive,
      ruleProfileInitialized: ruleProfileConfirmed,
      verificationStatus
    }),
    [currentSpaceStatus, ruleProfileConfirmed, sessionAlive, verificationStatus]
  );
  const ruleProfile = useRuleProfileController({
    basePolicyInput,
    currentSpaceId,
    currentSpaceStatus,
    ruleProfileConfirmed,
    sessionAlive,
    verificationPending,
    setActivePage,
    setCurrentSpace,
    setCurrentSpaceIsTemporary,
    setError,
    setRuleProfileConfirmed,
    setShowCreateForm,
    setStatus,
    ensureLiveSession
  });
  const {
    draftRuleIds,
    frozenRuleIds,
    importedRules,
    ruleImportText,
    setRuleImportText,
    confirmingProfile,
    availableRuleOptions,
    ruleCatalog,
    frozenRules,
    draftRules,
    effectiveRules,
    editRuleProfileAllowed,
    draftRuleProfileAllowed,
    confirmRuleProfileAllowed,
    resetRuleProfile,
    applyDraftProfile,
    applyPersistedProfile,
    handleImportRule,
    handleImportedRuleToggle,
    handleImportedRuleNameChange,
    handleImportedRuleDelete,
    handleDraftRuleToggle,
    handleConfirmRuleProfile
  } = ruleProfile;

  const loadSpaceProfile = useCallback(async (spaceId: string) => {
    const profile = await listSpaceProfile(spaceId);
    if (!profile) {
      resetRuleProfile();
      return;
    }

    try {
      // profile 中的导入规则只恢复声明式 manifest，不恢复任何运行时代码。
      const manifests = profile.importedRuleManifests.map((manifest) =>
        parseImportedRuleManifest(JSON.stringify(manifest))
      );
      applyPersistedProfile(profile.ruleChain, manifests);
      setStatus("已载入存储空间规则链配置。");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "存储空间规则链配置无效。");
      notifySystem({
        tone: "error",
        title: "空间配置读取失败",
        body: "存储空间规则链配置无效，请检查本地数据状态。"
      });
    }
  }, [applyPersistedProfile, notifySystem, resetRuleProfile]);

  const spaceAccess = useSpaceAccessController({
    clearSensitiveState,
    currentSpaceId,
    loadSpaceProfile,
    resetRuleProfile,
    session,
    setActivePage,
    setCurrentSpace,
    setCurrentSpaceId,
    setCurrentSpaceIsTemporary,
    setEntries,
    setError,
    setLoggingIn,
    setLoginVerificationEntryId,
    setRuleProfileConfirmed,
    setSession,
    setShowCreateForm,
    setStatus,
    setUiState
  });
  const {
    leaveSpace,
    refreshEntries,
    inspectSpace,
    withLiveSession,
    handleStartSpaceSession,
    handleEnterSpace
  } = spaceAccess;
  const spaceIndex = useSpaceIndexController(outsideSpace, handleEnterSpace, setError, setStatus);
  const detachedPasswordController = useDetachedPasswordController({
    setError,
    setStatus
  });

  const pendingDetachedEntrySecret = detachedPasswordController.pendingDetachedEntrySecret;
  const detachedMigrationFormVisible = detachedPasswordController.detachedMigrationFormVisible;
  const setDetachedMigrationFormVisible = detachedPasswordController.setDetachedMigrationFormVisible;

  useEffect(() => {
    if (outsideSpace || !pendingDetachedEntrySecret || detachedMigrationFormVisible) {
      return;
    }
    setActivePage("passwords");
    setDetachedMigrationFormVisible(true);
  }, [detachedMigrationFormVisible, outsideSpace, pendingDetachedEntrySecret, setDetachedMigrationFormVisible]);

  const groupController = usePasswordGroupController({
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
  });
  const {
    passwordGroups,
    setPasswordGroups,
    refreshPasswordGroups
  } = groupController;

  useEffect(() => {
    if (outsideSpace) {
      setPasswordGroups([]);
      return;
    }
    void refreshPasswordGroups();
  }, [outsideSpace, refreshPasswordGroups, setPasswordGroups]);

  const entryActions = usePasswordEntryController({
    basePolicyInput,
    currentSpaceId,
    currentSpaceStatus,
    effectiveRules,
    frozenRuleIds,
    loginVerificationEntryId,
    ruleCatalog,
    ruleProfileConfirmed,
    verificationPending,
    entryRuntime,
    refreshEntries,
    setCreatingPassword,
    setCurrentSpace,
    setCurrentSpaceIsTemporary,
    setError,
    setLoginVerificationEntryId,
    setShowCreateForm,
    setStatus,
    setUiState,
    ensureLiveSession,
    withLiveSession
  });
  const {
    policyForEntry,
    canViewMemoryHint,
    handleCreatePassword,
    handleReveal,
    handleShowMemoryHint,
    handleStartEntryEdit,
    readEditingMemoryHint,
    handleHideEditingMemoryHint,
    handleCancelEntryEdit,
    handleSaveEntryEdit,
    handleClearMemoryHint,
    handleEntryPatch,
    handleDeprecateEntry
  } = entryActions;

  const workspaceActions = useWorkspaceActions({
    basePolicyInput,
    currentSpaceId,
    outsideSpace,
    ruleProfileConfirmed,
    verificationPending,
    leaveSpace,
    refreshSpaceIndex: spaceIndex.refreshSpaceIndex,
    resetRuleProfile,
    setActivePage,
    setEntries,
    setError,
    setShowCreateForm,
    setStatus,
    setVisibleEntryId: entryRuntime.setVisibleEntryId,
    setVisiblePassword: entryRuntime.setVisiblePassword
  });
  const {
    createEntryAllowed,
    testCleanupAllowed,
    testToolSpaceId,
    setTestToolSpaceId,
    handleCreateEntryClick,
    handleClearPasswords,
    handleClearProfile,
    handleResetLocalData,
    handleDeleteTestSpace
  } = workspaceActions;

  const spaceManagement = useSpaceManagementController({
    basePolicyInput,
    currentSpaceId,
    effectiveRuleIds: frozenRuleIds,
    ruleCatalog,
    ruleProfileConfirmed,
    ensureLiveSession,
    withLiveSession,
    enterSpace: handleEnterSpace,
    refreshEntries,
    refreshSpaceIndex: spaceIndex.refreshSpaceIndex,
    notifySystem,
    setError,
    setStatus
  });

  useEffect(() => {
    setAppliedMigrationDraftBatchId("");
    setAutoReadyingMigrationBatchId("");
  }, [currentSpaceId]);

  useEffect(() => {
    if (outsideSpace || ruleProfileConfirmed || appliedMigrationDraftBatchId) {
      return;
    }
    const draftBatch = spaceManagement.migrationBatches.find(
      (batch) => batch.status === "draft" && (
        batch.sourceProfileSnapshot.ruleChain.length > 0 ||
        batch.sourceProfileSnapshot.importedRuleManifests.length > 0
      )
    );
    if (!draftBatch) {
      return;
    }

    try {
      const manifests = draftBatch.sourceProfileSnapshot.importedRuleManifests.map((manifest) =>
        parseImportedRuleManifest(JSON.stringify(manifest))
      );
      applyDraftProfile(draftBatch.sourceProfileSnapshot.ruleChain as ActiveRuleId[], manifests);
      setAppliedMigrationDraftBatchId(draftBatch.id);
      setStatus("已载入来源空间规则链草稿，请在规则管理页确认初始化后再迁移密码条目。");
    } catch (profileError) {
      setAppliedMigrationDraftBatchId(draftBatch.id);
      setError(profileError instanceof Error ? profileError.message : "来源空间规则链快照无效。");
      notifySystem({
        tone: "error",
        title: "迁移规则草稿读取失败",
        body: "来源空间规则链快照无效，请检查本地迁移数据。"
      });
    }
  }, [
    appliedMigrationDraftBatchId,
    applyDraftProfile,
    notifySystem,
    outsideSpace,
    ruleProfileConfirmed,
    setError,
    spaceManagement.migrationBatches
  ]);

  useEffect(() => {
    if (outsideSpace || !ruleProfileConfirmed || !basePolicyInput.sessionAlive) {
      return;
    }
    const draftBatch = spaceManagement.migrationBatches.find((batch) => batch.status === "draft");
    if (!draftBatch || autoReadyingMigrationBatchId === draftBatch.id) {
      return;
    }

    setAutoReadyingMigrationBatchId(draftBatch.id);
    void spaceManagement.handleMarkReadyMigrationBatches()
      .then((marked) => {
        if (!marked) {
          setAutoReadyingMigrationBatchId("");
        }
      })
      .catch((readyError: unknown) => {
        setAutoReadyingMigrationBatchId("");
        setError(readyError instanceof Error ? readyError.message : "迁移批次无法自动进入就绪状态。");
      });
  }, [
    autoReadyingMigrationBatchId,
    basePolicyInput.sessionAlive,
    outsideSpace,
    ruleProfileConfirmed,
    setError,
    spaceManagement
  ]);



  return {
    uiState,
    currentSpaceId,
    currentSpaceIsTemporary,
    loginVerificationEntryId,
    handleSelectLoginVerificationEntry,
    draftRuleIds,
    frozenRuleIds,
    ruleProfileConfirmed,
    entries,
    ...entryRuntime,
    importedRules,
    ruleImportText,
    setRuleImportText,
    activePage,
    setActivePage,
    showCreateForm,
    loggingIn,
    creatingPassword,
    confirmingProfile,
    status,
    error,
    ...systemNotifications,
    outsideSpace,
    sessionAlive,
    ...spaceIndex,
    availableRuleOptions,
    ruleCatalog,
    frozenRules,
    draftRules,
    effectiveRules,
    verificationPending,
    verificationStatus,
    currentSpaceStatus,
    basePolicyInput,
    createEntryAllowed,
    editRuleProfileAllowed,
    draftRuleProfileAllowed,
    confirmRuleProfileAllowed,
    testCleanupAllowed,
    testToolSpaceId,
    setTestToolSpaceId,
    policyForEntry,
    canViewMemoryHint,
    leaveSpace,
    refreshEntries,
    inspectSpace,
    handleEnterSpace,
    handleStartSpaceSession,
    handleCreatePassword,
    handleReveal,
    handleShowMemoryHint,
    handleStartEntryEdit,
    readEditingMemoryHint,
    handleHideEditingMemoryHint,
    handleCancelEntryEdit,
    handleSaveEntryEdit,
    handleClearMemoryHint,
    handleEntryPatch,
    handleDeprecateEntry,
    handleImportRule,
    handleImportedRuleToggle,
    handleImportedRuleNameChange,
    handleImportedRuleDelete,
    handleDraftRuleToggle,
    handleConfirmRuleProfile,
    handleCreateEntryClick,
    handleClearPasswords,
    handleClearProfile,
    handleResetLocalData,
    handleDeleteTestSpace,
    ...groupController,
    ...detachedPasswordController,
    ...spaceManagement
  };
}

export type AppController = ReturnType<typeof useAppController>;
export { spaceStatusLabels };
