import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSession,
  isSessionExpired,
  touchSession,
  wipeSession,
  type Session
} from "../../session-manager/session-manager";
import {
  listMigrationBatchesForTarget,
  listMigrationEntriesByBatch,
  listRelationsForSpace,
  type MigrationBatch,
  type MigrationEntry,
  type MigrationMode,
  type SpaceRelation
} from "../../storage-data";
import { canManageMigration } from "../../space/policy";
import {
  createMigrationBatchFromSpace,
  finalizeMigrationBatchManually,
  markMigrationBatchReady,
  migrateEntry,
  skipMigrationEntry,
  updateMigrationBatchFinalizationPreference,
  verifyMigrationSourceEntry
} from "../../space/migration";
import {
  exportSpacePackage,
  stringifySpaceExportPackage
} from "../../space/transfer";
import type { SpacePolicyInput } from "../../space/types";
import type { Session as TargetSession } from "../../session-manager/session-manager";
import type { ActiveRuleId, RuleDefinition } from "../../rule-registry/rules";
import type { NoticeMessage } from "../notifications/types";

type UseSpaceManagementControllerInput = {
  basePolicyInput: SpacePolicyInput;
  currentSpaceId: string;
  effectiveRuleIds: ActiveRuleId[];
  ruleCatalog: RuleDefinition[];
  ruleProfileConfirmed: boolean;
  ensureLiveSession: (masterPassword?: string) => Promise<TargetSession>;
  withLiveSession: <T>(
    operation: (liveSession: TargetSession) => Promise<T>
  ) => Promise<T>;
  enterSpace: (input: { spaceId: string }) => Promise<boolean>;
  refreshEntries: () => Promise<void>;
  refreshSpaceIndex: () => Promise<void>;
  notifySystem: (
    input: Omit<NoticeMessage, "scope"> & { scope?: "system" }
  ) => void;
  setError: (message: string) => void;
  setStatus: (message: string) => void;
};

export type SpaceOperationMode =
  | ""
  | "clone_current_profile"
  | "clone_current_with_entries"
  | "export_profile"
  | "export_full";

export function useSpaceManagementController({
  basePolicyInput,
  currentSpaceId,
  effectiveRuleIds,
  ruleCatalog,
  ruleProfileConfirmed,
  ensureLiveSession,
  withLiveSession,
  enterSpace,
  refreshEntries,
  refreshSpaceIndex,
  notifySystem,
  setError,
  setStatus
}: UseSpaceManagementControllerInput) {
  const [migrationBatches, setMigrationBatches] = useState<MigrationBatch[]>(
    []
  );
  const [migrationEntries, setMigrationEntries] = useState<MigrationEntry[]>(
    []
  );
  const [spaceRelations, setSpaceRelations] = useState<SpaceRelation[]>([]);
  const [selectedMigrationBatchId, setSelectedMigrationBatchId] = useState("");
  const [exportText, setExportText] = useState("");
  const [spaceOperationMode, setSpaceOperationMode] =
    useState<SpaceOperationMode>("");
  const [createTargetSpaceId, setCreateTargetSpaceId] = useState("");
  const [sourceMasterPassword, setSourceMasterPassword] = useState("");
  const [migrationTargetMasterPassword, setMigrationTargetMasterPassword] =
    useState("");
  const [sourceSession, setSourceSession] = useState<Session | null>(null);
  const [sourceSessionVerified, setSourceSessionVerified] = useState(false);
  const [sourceSessionVerifying, setSourceSessionVerifying] = useState(false);
  const [sourceVerificationFeedback, setSourceVerificationFeedback] =
    useState("");
  const [sourceVerificationFeedbackTone, setSourceVerificationFeedbackTone] =
    useState<"info" | "success" | "error">("info");
  const [sourceVerificationEntryId, setSourceVerificationEntryId] =
    useState("");
  const [oldEntrySecrets, setOldEntrySecrets] = useState<
    Record<string, string>
  >({});
  const [newEntrySecrets, setNewEntrySecrets] = useState<
    Record<string, string>
  >({});
  const [reuseOldEntrySecret, setReuseOldEntrySecret] = useState<
    Record<string, boolean>
  >({});
  const [migrationModes, setMigrationModes] = useState<
    Record<string, MigrationMode>
  >({});
  const [externalPasswordUpdated, setExternalPasswordUpdated] = useState<
    Record<string, boolean>
  >({});
  const [lastMigratedPassword, setLastMigratedPassword] = useState("");
  const [migrationEntryFeedbacks, setMigrationEntryFeedbacks] = useState<
    Record<
      string,
      {
        tone: "success" | "error";
        title: string;
        body: string;
      }
    >
  >({});
  const migrationAllowed = canManageMigration({
    ...basePolicyInput,
    sessionAlive: true
  });

  const selectedMigrationBatch = useMemo(
    () =>
      migrationBatches.find((batch) => batch.id === selectedMigrationBatchId) ??
      migrationBatches[0] ??
      null,
    [migrationBatches, selectedMigrationBatchId]
  );

  const refreshMigrations = useCallback(async () => {
    if (!currentSpaceId) {
      setMigrationBatches([]);
      setMigrationEntries([]);
      setSpaceRelations([]);
      return;
    }
    try {
      const [batches, relations] = await Promise.all([
        listMigrationBatchesForTarget(currentSpaceId),
        listRelationsForSpace(currentSpaceId)
      ]);
      setMigrationBatches(batches);
      setSpaceRelations(relations);
      const nextBatch =
        batches.find((batch) => batch.status !== "completed") ??
        batches[0] ??
        null;
      setSelectedMigrationBatchId(nextBatch?.id ?? "");
      const nextEntries = nextBatch
        ? await listMigrationEntriesByBatch(nextBatch.id)
        : [];
      setMigrationEntries(nextEntries);
      setSourceVerificationEntryId((current) =>
        current &&
        nextEntries.some(
          (entry) => entry.id === current && entry.status === "pending"
        )
          ? current
          : (nextEntries.find((entry) => entry.status === "pending")?.id ?? "")
      );
    } catch (refreshError) {
      setMigrationBatches([]);
      setMigrationEntries([]);
      setSourceVerificationEntryId("");
      setSpaceRelations([]);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "无法读取空间迁移和关系数据。"
      );
    }
  }, [currentSpaceId, setError]);

  useEffect(() => {
    void refreshMigrations();
  }, [refreshMigrations]);

  useEffect(() => {
    if (!selectedMigrationBatchId) {
      setMigrationEntries([]);
      setSourceVerificationEntryId("");
      return;
    }
    void listMigrationEntriesByBatch(selectedMigrationBatchId)
      .then((entries) => {
        setMigrationEntries(entries);
        setSourceVerificationEntryId((current) =>
          current &&
          entries.some(
            (entry) => entry.id === current && entry.status === "pending"
          )
            ? current
            : (entries.find((entry) => entry.status === "pending")?.id ?? "")
        );
      })
      .catch((refreshError) => {
        setMigrationEntries([]);
        setSourceVerificationEntryId("");
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "无法读取迁移条目。"
        );
      });
  }, [selectedMigrationBatchId, setError]);

  useEffect(() => {
    setSourceSession(wipeSession());
    setSourceSessionVerified(false);
    setSourceSessionVerifying(false);
    setSourceVerificationFeedback("");
    setSourceVerificationFeedbackTone("info");
    setSourceMasterPassword("");
    setMigrationTargetMasterPassword("");
    setSourceVerificationEntryId("");
    setMigrationEntryFeedbacks({});
  }, [currentSpaceId, selectedMigrationBatchId]);

  function handleSelectSourceVerificationEntry(entryId: string) {
    setError("");
    setStatus("");
    setSourceVerificationEntryId(entryId);
    setSourceSession(wipeSession());
    setSourceSessionVerified(false);
    setSourceSessionVerifying(false);
    setSourceVerificationFeedback("");
    setSourceVerificationFeedbackTone("info");
    setSourceMasterPassword("");
  }

  const withMigrationTargetSession = useCallback(
    async <T>(
      operation: (liveSession: TargetSession) => Promise<T>
    ): Promise<T> => {
      if (basePolicyInput.sessionAlive) {
        return withLiveSession(operation);
      }
      if (!migrationTargetMasterPassword.trim()) {
        throw new Error("请输入目标空间主密码。");
      }
      const liveSession = await ensureLiveSession(
        migrationTargetMasterPassword
      );
      setMigrationTargetMasterPassword("");
      return operation(liveSession);
    },
    [
      basePolicyInput.sessionAlive,
      ensureLiveSession,
      migrationTargetMasterPassword,
      withLiveSession
    ]
  );

  async function handleExportSpace(includeEntries: boolean) {
    setError("");
    setStatus("");
    try {
      await withLiveSession(async () => {
        const pkg = await exportSpacePackage({
          spaceId: currentSpaceId,
          includeEntries
        });
        setExportText(stringifySpaceExportPackage(pkg));
        setStatus(
          includeEntries
            ? "已生成完整备份 JSON。导入后密码条目会进入迁移队列。"
            : "已生成空间配置 JSON。"
        );
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "无法导出空间数据。"
      );
    }
  }

  async function handleCloneCurrentSpace(includeEntries: boolean) {
    setError("");
    setStatus("");
    try {
      const targetSpaceId = createTargetSpaceId.trim().toLowerCase();
      if (!targetSpaceId) {
        throw new Error("请输入目标存储空间 ID。");
      }
      const batch = await withLiveSession(async () =>
        createMigrationBatchFromSpace({
          sourceSpaceId: currentSpaceId,
          targetSpaceId,
          copyProfile: true,
          includeEntries
        })
      );
      await refreshSpaceIndex();
      setCreateTargetSpaceId("");
      setSpaceOperationMode("");
      const entered = await enterSpace({ spaceId: targetSpaceId });
      if (entered) {
        setStatus(
          batch
            ? "已从当前空间创建目标空间和迁移队列，并进入目标空间主页。请先在空间主页设置空间主密码后继续。"
            : "已 clone 当前空间配置到新空间，并进入目标空间主页。请先在空间主页设置空间主密码后继续。"
        );
      }
    } catch (cloneError) {
      setError(
        cloneError instanceof Error
          ? cloneError.message
          : "无法 clone 当前空间。"
      );
    }
  }

  async function handleCurrentSpaceOperation() {
    if (spaceOperationMode === "clone_current_profile") {
      await handleCloneCurrentSpace(false);
      return;
    }
    if (spaceOperationMode === "clone_current_with_entries") {
      await handleCloneCurrentSpace(true);
      return;
    }
    if (spaceOperationMode === "export_profile") {
      await handleExportSpace(false);
      return;
    }
    if (spaceOperationMode === "export_full") {
      await handleExportSpace(true);
      return;
    }
    setError("请选择当前空间操作。");
  }

  const handleMarkReadyMigrationBatches = useCallback(async () => {
    const draftBatches = migrationBatches.filter(
      (batch) => batch.status === "draft"
    );
    if (
      draftBatches.length === 0 ||
      !ruleProfileConfirmed ||
      !migrationAllowed
    ) {
      return false;
    }

    await withMigrationTargetSession(async () => {
      await Promise.all(
        draftBatches.map((batch) => markMigrationBatchReady(batch.id))
      );
      await refreshMigrations();
      setStatus("目标规则链已初始化，迁移批次已自动就绪。");
    });
    return true;
  }, [
    migrationAllowed,
    migrationBatches,
    refreshMigrations,
    ruleProfileConfirmed,
    setStatus,
    withMigrationTargetSession
  ]);

  async function handleMigrationAutoFinalizeChange(
    autoFinalizeSource: boolean
  ) {
    setError("");
    setStatus("");
    try {
      if (!selectedMigrationBatch) {
        throw new Error("当前没有迁移批次。");
      }
      await updateMigrationBatchFinalizationPreference(
        selectedMigrationBatch.id,
        autoFinalizeSource
      );
      await refreshMigrations();
      setStatus(
        autoFinalizeSource
          ? "迁移完成后会自动流转来源空间状态。"
          : "已改为手动流转来源空间状态。"
      );
    } catch (preferenceError) {
      setError(
        preferenceError instanceof Error
          ? preferenceError.message
          : "无法更新迁移流转设置。"
      );
    }
  }

  async function handleFinalizeMigrationBatch() {
    setError("");
    setStatus("");
    try {
      if (!selectedMigrationBatch) {
        throw new Error("当前没有迁移批次。");
      }
      await finalizeMigrationBatchManually(selectedMigrationBatch.id);
      await refreshMigrations();
      setStatus("来源空间状态已手动流转为历史空间，并已记录接替关系。");
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "无法流转来源空间状态。"
      );
    }
  }

  async function handleVerifySourceSession() {
    setError("");
    setStatus("");
    setSourceVerificationFeedback("正在校验来源空间，请稍候。");
    setSourceVerificationFeedbackTone("info");
    setSourceSessionVerifying(true);
    try {
      if (!selectedMigrationBatch) {
        throw new Error("当前没有迁移批次。");
      }
      const pendingEntry =
        migrationEntries.find(
          (entry) =>
            entry.id === sourceVerificationEntryId && entry.status === "pending"
        ) ?? migrationEntries.find((entry) => entry.status === "pending");
      if (!pendingEntry) {
        throw new Error("当前没有待校验的迁移条目。");
      }
      const oldEntrySecret = oldEntrySecrets[pendingEntry.id] ?? "";
      if (!sourceMasterPassword.trim()) {
        throw new Error("请输入旧空间主密码。");
      }
      if (!oldEntrySecret.trim()) {
        throw new Error("请输入所选旧密码条目的旧关键密钥。");
      }
      const nextSourceSession = await createSession(sourceMasterPassword);
      await verifyMigrationSourceEntry(
        selectedMigrationBatch.id,
        pendingEntry.id,
        nextSourceSession,
        oldEntrySecret
      );
      setSourceSession(nextSourceSession);
      setSourceSessionVerified(true);
      setSourceVerificationEntryId(pendingEntry.id);
      setSourceMasterPassword("");
      setSourceVerificationFeedback("来源空间已完成校验。");
      setSourceVerificationFeedbackTone("success");
      setStatus("来源空间已校验，后续迁移只需为每条密码填写对应旧关键密钥。");
      notifySystem({
        tone: "success",
        title: "来源空间校验完成",
        body: "来源空间已完成校验，可以继续迁移条目。"
      });
    } catch (verifyError) {
      const message =
        verifyError instanceof Error
          ? verifyError.message
          : "请检查旧空间主密码和所选旧密码条目的旧关键密钥。";
      setSourceVerificationFeedback(message);
      setSourceVerificationFeedbackTone("error");
      setError(message);
      notifySystem({
        tone: "error",
        title: "来源空间校验失败",
        body: message
      });
    } finally {
      setSourceSessionVerifying(false);
    }
  }

  async function handleMigrateEntry(entry: MigrationEntry) {
    setError("");
    setStatus("");
    setLastMigratedPassword("");
    setMigrationEntryFeedbacks((current) => {
      const next = { ...current };
      delete next[entry.id];
      return next;
    });
    try {
      if (!selectedMigrationBatch) {
        throw new Error("当前没有迁移批次。");
      }
      if (!migrationAllowed) {
        throw new Error("请先完成空间校验并初始化目标空间规则链。");
      }
      if (!sourceSession || isSessionExpired(sourceSession)) {
        setSourceSession(wipeSession());
        setSourceSessionVerified(false);
        throw new Error("来源空间会话已过期，请重新输入旧空间主密码。");
      }
      await withMigrationTargetSession(async (targetSession) => {
        const liveSourceSession = touchSession(sourceSession);
        setSourceSession(liveSourceSession);
        const oldEntrySecret = oldEntrySecrets[entry.id] ?? "";
        const newEntrySecret = reuseOldEntrySecret[entry.id]
          ? oldEntrySecret
          : (newEntrySecrets[entry.id] ?? "");
        const mode = migrationModes[entry.id] ?? "preserve_password";
        const result = await migrateEntry({
          batchId: selectedMigrationBatch.id,
          entryId: entry.id,
          mode,
          sourceSession: liveSourceSession,
          targetSession,
          oldEntrySecret,
          newEntrySecret,
          targetRuleIds: effectiveRuleIds,
          targetRuleCatalog: ruleCatalog,
          externalPasswordUpdated:
            mode === "preserve_password" ||
            Boolean(externalPasswordUpdated[entry.id])
        });
        await refreshEntries();
        await refreshMigrations();
        setOldEntrySecrets((current) => ({ ...current, [entry.id]: "" }));
        setNewEntrySecrets((current) => ({ ...current, [entry.id]: "" }));
        setLastMigratedPassword(result.password);
        const message =
          mode === "regenerate_password"
            ? "已按目标规则生成新密码并完成迁移。"
            : "已保持平台密码不变并完成迁移。";
        setMigrationEntryFeedbacks((current) => ({
          ...current,
          [entry.id]: {
            tone: "success",
            title: "迁移完成",
            body: message
          }
        }));
        setStatus(message);
      });
    } catch (migrateError) {
      const message =
        migrateError instanceof Error ? migrateError.message : "无法迁移条目。";
      setMigrationEntryFeedbacks((current) => ({
        ...current,
        [entry.id]: {
          tone: "error",
          title: "迁移失败",
          body: message
        }
      }));
      setError(message);
    }
  }

  async function handleSkipMigrationEntry(entry: MigrationEntry) {
    setError("");
    setStatus("");
    setMigrationEntryFeedbacks((current) => {
      const next = { ...current };
      delete next[entry.id];
      return next;
    });
    try {
      if (!selectedMigrationBatch) {
        throw new Error("当前没有迁移批次。");
      }
      if (!migrationAllowed) {
        throw new Error("请先完成空间校验并初始化目标空间规则链。");
      }
      await withMigrationTargetSession(async () => {
        await skipMigrationEntry(selectedMigrationBatch.id, entry.id);
        await refreshMigrations();
        setMigrationEntryFeedbacks((current) => ({
          ...current,
          [entry.id]: {
            tone: "success",
            title: "已跳过迁移",
            body: "已跳过这条迁移任务。"
          }
        }));
        setStatus("已跳过这条迁移任务。");
      });
    } catch (skipError) {
      const message =
        skipError instanceof Error ? skipError.message : "无法跳过迁移条目。";
      setMigrationEntryFeedbacks((current) => ({
        ...current,
        [entry.id]: {
          tone: "error",
          title: "跳过失败",
          body: message
        }
      }));
      setError(message);
    }
  }

  return {
    migrationBatches,
    migrationEntries,
    spaceRelations,
    selectedMigrationBatch,
    selectedMigrationBatchId,
    setSelectedMigrationBatchId,
    exportText,
    setExportText,
    spaceOperationMode,
    setSpaceOperationMode,
    createTargetSpaceId,
    setCreateTargetSpaceId,
    sourceMasterPassword,
    setSourceMasterPassword,
    migrationTargetMasterPassword,
    setMigrationTargetMasterPassword,
    sourceSessionVerified,
    sourceSessionVerifying,
    sourceVerificationFeedback,
    sourceVerificationFeedbackTone,
    sourceVerificationEntryId,
    setSourceVerificationEntryId: handleSelectSourceVerificationEntry,
    oldEntrySecrets,
    setOldEntrySecrets,
    newEntrySecrets,
    setNewEntrySecrets,
    reuseOldEntrySecret,
    setReuseOldEntrySecret,
    migrationModes,
    setMigrationModes,
    externalPasswordUpdated,
    setExternalPasswordUpdated,
    lastMigratedPassword,
    migrationEntryFeedbacks,
    migrationAllowed,
    refreshMigrations,
    handleExportSpace,
    handleCloneCurrentSpace,
    handleCurrentSpaceOperation,
    handleMarkReadyMigrationBatches,
    handleMigrationAutoFinalizeChange,
    handleFinalizeMigrationBatch,
    handleVerifySourceSession,
    handleMigrateEntry,
    handleSkipMigrationEntry
  };
}
