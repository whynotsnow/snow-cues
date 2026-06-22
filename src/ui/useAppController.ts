import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseImportedRuleManifest,
  type ActiveRuleId
} from "../rule-registry/rules";
import {
  createSession,
  isSessionExpired,
  touchSession,
  type Session
} from "../session-manager/session-manager";
import {
  getStorageDataRepository,
  listSpaceProfile,
  resetStorageDataRepository,
  type PasswordEntry,
  type SpaceRecord
} from "../storage-data";
import {
  EXTERNAL_CHANGE_MESSAGE,
  buildNextStorageDataFile,
  createInitialStorageDataFile,
  createStorageDataFolder,
  createStorageDataWorkspaceFromFile,
  diffStorageDataContent,
  exportStorageDataDraft,
  hasStorageDataChanges,
  openStorageDataFolder,
  parseStorageDataFileText,
  saveStorageDataWorkspace,
  serializeStorageDataFile,
  type StorageDataFile,
  type StorageDataSaveSummary,
  type StorageDataWorkspace
} from "../storage-data";
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
  const [loginVerificationEntryId, setLoginVerificationEntryId] = useState<
    string | null
  >(null);
  const [ruleProfileConfirmed, setRuleProfileConfirmed] = useState(false);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const entryRuntime = useEntryRuntimeState();
  const [activePage, setActivePage] = useState<AppPage>("passwords");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [creatingPassword, setCreatingPassword] = useState(false);
  const [appliedMigrationDraftBatchId, setAppliedMigrationDraftBatchId] =
    useState("");
  const [autoReadyingMigrationBatchId, setAutoReadyingMigrationBatchId] =
    useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [storageDataWorkspace, setStorageDataWorkspace] =
    useState<StorageDataWorkspace | null>(null);
  const [storageDataSaveSummary, setStorageDataSaveSummary] =
    useState<StorageDataSaveSummary | null>(null);
  const [storageDataDownloadText, setStorageDataDownloadText] = useState("");
  const [storageDataDraftText, setStorageDataDraftText] = useState("");
  const [storageDataCompareSummary, setStorageDataCompareSummary] =
    useState<StorageDataSaveSummary | null>(null);
  const [storageDataCompareWarning, setStorageDataCompareWarning] =
    useState("");
  const systemNotifications = useSystemNotifications();
  const { notifySystem } = systemNotifications;

  const sessionAlive = Boolean(session && !isSessionExpired(session));
  const outsideSpace = uiState === "OUT_OF_SPACE" || uiState === "LEFT_SPACE";
  const storageDataOpened = Boolean(storageDataWorkspace);
  const storageDataDirty = storageDataWorkspace
    ? getStorageDataRepository().isDirty()
    : false;
  const storageDataMode = storageDataWorkspace?.mode ?? null;
  const storageDataId = storageDataWorkspace?.file.storageDataId ?? "";
  const storageDataRevision = storageDataWorkspace?.file.revision ?? 0;
  const storageDataUpdatedAt = storageDataWorkspace?.file.updatedAt ?? "";
  const verificationPending = Boolean(loginVerificationEntryId);
  const verificationStatus: SpaceRuntimeVerificationStatus =
    entries.length === 0
      ? "not_required"
      : loginVerificationEntryId
        ? "pending"
        : "verified";
  const currentSpaceStatus = currentSpace?.status ?? "active";
  const assertCanChangeLoadedStorageData = useCallback(() => {
    if (!outsideSpace) {
      setError("已进入空间。请先离开空间，再更换或重新加载存储数据文件。");
      return false;
    }
    return true;
  }, [outsideSpace]);
  const applyStorageDataFile = useCallback(
    async (
      file: StorageDataFile,
      mode: "download" | "direct-folder" = "download"
    ) => {
      resetStorageDataRepository(file.data);
      const workspace = await createStorageDataWorkspaceFromFile(file);
      workspace.mode = mode;
      workspace.repository = getStorageDataRepository();
      setStorageDataWorkspace(workspace);
      setStorageDataSaveSummary(null);
      setStorageDataDownloadText("");
      setStorageDataDraftText("");
      setStorageDataCompareSummary(null);
      setStorageDataCompareWarning("");
    },
    []
  );

  const handleCreateStorageData = useCallback(async () => {
    if (!assertCanChangeLoadedStorageData()) {
      return;
    }
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.showDirectoryPicker === "function"
      ) {
        const directoryHandle = await window.showDirectoryPicker();
        const workspace = await createStorageDataFolder(directoryHandle);
        resetStorageDataRepository(workspace.file.data);
        workspace.repository = getStorageDataRepository();
        setStorageDataWorkspace(workspace);
        setStatus("已新建存储数据文件夹。保存前请确认 Syncthing 已完成同步。");
        return;
      }
      const emptyFile = await createInitialStorageDataFile();
      const repository = getStorageDataRepository();
      const snapshot = repository.snapshot();
      const hasSnapshotContent = Object.values(snapshot).some(
        (collection) => collection.length > 0
      );
      const file =
        repository.isDirty() || hasSnapshotContent
          ? await buildNextStorageDataFile(emptyFile, snapshot)
          : emptyFile;
      await applyStorageDataFile(file, "download");
      setStorageDataDownloadText(serializeStorageDataFile(file));
      setStatus(
        "当前浏览器使用下载新版模式。已生成初始 current.json，请放入你的存储数据文件夹。"
      );
    } catch (storageError) {
      setError(
        storageError instanceof Error
          ? storageError.message
          : "新建存储数据失败。"
      );
    }
  }, [applyStorageDataFile, assertCanChangeLoadedStorageData]);

  const handleOpenStorageDataText = useCallback(
    async (text: string) => {
      if (!assertCanChangeLoadedStorageData()) {
        return;
      }
      try {
        const file = await parseStorageDataFileText(text);
        await applyStorageDataFile(file, "download");
        setStatus("已打开存储数据文件。保存时会生成新版文件下载。");
      } catch (storageError) {
        setError(
          storageError instanceof Error
            ? storageError.message
            : "打开存储数据失败。"
        );
      }
    },
    [applyStorageDataFile, assertCanChangeLoadedStorageData]
  );

  const handleOpenStorageDataFolder = useCallback(async () => {
    if (!assertCanChangeLoadedStorageData()) {
      return;
    }
    try {
      if (
        typeof window === "undefined" ||
        typeof window.showDirectoryPicker !== "function"
      ) {
        setError(
          "当前浏览器不支持直接打开存储数据文件夹，请选择 current.json 使用下载新版模式。"
        );
        return;
      }
      const directoryHandle = await window.showDirectoryPicker();
      const workspace = await openStorageDataFolder(directoryHandle);
      resetStorageDataRepository(workspace.file.data);
      workspace.repository = getStorageDataRepository();
      setStorageDataWorkspace(workspace);
      setStatus("已打开存储数据文件夹。编辑前请确认 Syncthing 已完成同步。");
    } catch (storageError) {
      setError(
        storageError instanceof Error
          ? storageError.message
          : "打开存储数据文件夹失败。"
      );
    }
  }, [assertCanChangeLoadedStorageData]);

  const handlePrepareStorageDataSave = useCallback(() => {
    if (!storageDataWorkspace) {
      setError("请先打开或新建存储数据。");
      return;
    }
    const summary = diffStorageDataContent(
      storageDataWorkspace.file.data,
      getStorageDataRepository().snapshot()
    );
    if (!hasStorageDataChanges(summary)) {
      setError("没有可保存的存储数据改动。");
      return;
    }
    setStorageDataSaveSummary(summary);
    setStatus("请确认存储数据保存摘要。");
  }, [storageDataWorkspace]);

  const handleConfirmStorageDataSave = useCallback(async () => {
    if (!storageDataWorkspace) {
      setError("请先打开或新建存储数据。");
      return;
    }
    try {
      storageDataWorkspace.repository = getStorageDataRepository();
      const result = await saveStorageDataWorkspace(storageDataWorkspace);
      setStorageDataWorkspace({ ...storageDataWorkspace });
      setStorageDataSaveSummary(null);
      if (result.mode === "download") {
        setStorageDataDownloadText(result.content);
        setStatus(
          "已生成新版存储数据文件。请确认 Syncthing 状态后手动替换 current.json。"
        );
      } else {
        setStatus(
          "已写入新版 revision 并更新 current.json。切换设备前请等待 Syncthing 完成同步。"
        );
      }
    } catch (storageError) {
      const message =
        storageError instanceof Error
          ? storageError.message
          : "保存存储数据失败。";
      setError(message);
      if (message === EXTERNAL_CHANGE_MESSAGE) {
        notifySystem({
          tone: "warning",
          title: "存储数据已变化",
          body: "为避免覆盖其他设备的修改，本次保存已停止。"
        });
      }
    }
  }, [notifySystem, storageDataWorkspace]);

  const handleCancelStorageDataSave = useCallback(() => {
    setStorageDataSaveSummary(null);
  }, []);

  const handleExportStorageDataDraft = useCallback(async () => {
    if (!storageDataWorkspace) {
      setError("请先打开或新建存储数据。");
      return;
    }
    try {
      storageDataWorkspace.repository = getStorageDataRepository();
      const draft = await exportStorageDataDraft(
        storageDataWorkspace,
        "manual-export"
      );
      setStorageDataDraftText(draft.content);
      setStatus("已生成存储数据草稿。草稿不能作为 current.json 直接打开。");
    } catch (storageError) {
      setError(
        storageError instanceof Error
          ? storageError.message
          : "导出存储数据草稿失败。"
      );
    }
  }, [storageDataWorkspace]);

  const handleCompareStorageDataText = useCallback(
    async (leftText: string, rightText: string) => {
      try {
        const left = await parseStorageDataFileText(leftText);
        const right = await parseStorageDataFileText(rightText);
        setStorageDataCompareSummary(
          diffStorageDataContent(left.data, right.data)
        );
        setStorageDataCompareWarning(
          left.storageDataId === right.storageDataId
            ? ""
            : "这两个文件属于不同的存储数据集，请不要直接互相覆盖。"
        );
        setStatus("已完成两个存储数据文件的摘要比较。");
      } catch (storageError) {
        setError(
          storageError instanceof Error
            ? storageError.message
            : "比较存储数据文件失败。"
        );
      }
    },
    []
  );
  // 离开空间或会话过期时统一清理内存中的敏感运行时状态。
  const clearSensitiveState = useCallback(() => {
    entryRuntime.clearEntryRuntimeState();
    setLoginVerificationEntryId(null);
  }, [entryRuntime]);
  const handleSelectLoginVerificationEntry = useCallback(
    (entryId: string) => {
      setLoginVerificationEntryId(entryId);
      entryRuntime.setDecryptingEntryId(entryId);
      entryRuntime.setVisibleEntryId(null);
      entryRuntime.setVisiblePassword("");
      entryRuntime.setDecryptSpaceMasterPasswords({});
      entryRuntime.setDecryptEntrySecrets({});
      setStatus("");
      setError("");
    },
    [entryRuntime]
  );
  const ensureLiveSession = useCallback(
    async (masterPassword?: string): Promise<Session> => {
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
    },
    [clearSensitiveState, notifySystem, session]
  );
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

  const loadSpaceProfile = useCallback(
    async (spaceId: string) => {
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
        setError(
          profileError instanceof Error
            ? profileError.message
            : "存储空间规则链配置无效。"
        );
        notifySystem({
          tone: "error",
          title: "空间配置读取失败",
          body: "存储空间规则链配置无效，请检查本地数据状态。"
        });
      }
    },
    [applyPersistedProfile, notifySystem, resetRuleProfile]
  );

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
  const spaceIndex = useSpaceIndexController(
    outsideSpace,
    handleEnterSpace,
    setError,
    setStatus
  );

  useEffect(() => {
    if (!storageDataWorkspace || !outsideSpace) {
      return;
    }
    void spaceIndex.refreshSpaceIndex();
  }, [outsideSpace, spaceIndex.refreshSpaceIndex, storageDataWorkspace]);

  const detachedPasswordController = useDetachedPasswordController({
    setError,
    setStatus
  });

  const pendingDetachedEntrySecret =
    detachedPasswordController.pendingDetachedEntrySecret;
  const detachedMigrationFormVisible =
    detachedPasswordController.detachedMigrationFormVisible;
  const setDetachedMigrationFormVisible =
    detachedPasswordController.setDetachedMigrationFormVisible;

  useEffect(() => {
    if (
      outsideSpace ||
      !pendingDetachedEntrySecret ||
      detachedMigrationFormVisible
    ) {
      return;
    }
    setActivePage("passwords");
    setDetachedMigrationFormVisible(true);
  }, [
    detachedMigrationFormVisible,
    outsideSpace,
    pendingDetachedEntrySecret,
    setDetachedMigrationFormVisible
  ]);

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
  const { passwordGroups, setPasswordGroups, refreshPasswordGroups } =
    groupController;

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
      (batch) =>
        batch.status === "draft" &&
        (batch.sourceProfileSnapshot.ruleChain.length > 0 ||
          batch.sourceProfileSnapshot.importedRuleManifests.length > 0)
    );
    if (!draftBatch) {
      return;
    }

    try {
      const manifests =
        draftBatch.sourceProfileSnapshot.importedRuleManifests.map((manifest) =>
          parseImportedRuleManifest(JSON.stringify(manifest))
        );
      applyDraftProfile(
        draftBatch.sourceProfileSnapshot.ruleChain as ActiveRuleId[],
        manifests
      );
      setAppliedMigrationDraftBatchId(draftBatch.id);
      setStatus(
        "已载入来源空间规则链草稿，请在规则管理页确认初始化后再迁移密码条目。"
      );
    } catch (profileError) {
      setAppliedMigrationDraftBatchId(draftBatch.id);
      setError(
        profileError instanceof Error
          ? profileError.message
          : "来源空间规则链快照无效。"
      );
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
    if (
      outsideSpace ||
      !ruleProfileConfirmed ||
      !basePolicyInput.sessionAlive
    ) {
      return;
    }
    const draftBatch = spaceManagement.migrationBatches.find(
      (batch) => batch.status === "draft"
    );
    if (!draftBatch || autoReadyingMigrationBatchId === draftBatch.id) {
      return;
    }

    setAutoReadyingMigrationBatchId(draftBatch.id);
    void spaceManagement
      .handleMarkReadyMigrationBatches()
      .then((marked) => {
        if (!marked) {
          setAutoReadyingMigrationBatchId("");
        }
      })
      .catch((readyError: unknown) => {
        setAutoReadyingMigrationBatchId("");
        setError(
          readyError instanceof Error
            ? readyError.message
            : "迁移批次无法自动进入就绪状态。"
        );
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
    storageDataOpened,
    storageDataDirty,
    storageDataMode,
    storageDataId,
    storageDataRevision,
    storageDataUpdatedAt,
    storageDataSaveSummary,
    storageDataDownloadText,
    storageDataDraftText,
    storageDataCompareSummary,
    storageDataCompareWarning,
    handleCreateStorageData,
    handleOpenStorageDataText,
    handleOpenStorageDataFolder,
    handlePrepareStorageDataSave,
    handleConfirmStorageDataSave,
    handleCancelStorageDataSave,
    handleExportStorageDataDraft,
    handleCompareStorageDataText,
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
