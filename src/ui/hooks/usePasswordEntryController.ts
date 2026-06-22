import {
  decryptPassword,
  deriveRuntimeStorageKey,
  encryptPassword,
  generatePasswordWithRuleChain
} from "../../crypto-engine/crypto-engine";
import {
  decryptMemoryHint,
  encryptMemoryHint
} from "../../recovery-aid/recovery-aid";
import {
  createPasswordEntry,
  saveSpace,
  updatePasswordEntry,
  type PasswordEntry,
  type SpaceRecord
} from "../../storage-engine/storage-engine";
import {
  canCreateEntry,
  canDeprecateEntry,
  canDeriveInSpace,
  canEditEntryDescription,
  canEditEntryMetadata,
  canEditMemoryHint,
  canViewMemoryHint as canViewMemoryHintByPolicy
} from "../../space/policy";
import type { SpacePolicyInput } from "../../space/types";
import type { Session } from "../../session-manager/session-manager";
import type { ActiveRuleId, RuleDefinition } from "../../rule-registry/rules";
import type { CreatePasswordInput } from "./useCreatePasswordForm";
import type { useEntryRuntimeState } from "./useEntryRuntimeState";
import type { UiState } from "../appTypes";

type EntryRuntimeState = ReturnType<typeof useEntryRuntimeState>;

type UsePasswordEntryControllerInput = {
  basePolicyInput: SpacePolicyInput;
  currentSpaceId: string;
  currentSpaceStatus: SpaceRecord["status"];
  effectiveRules: RuleDefinition[];
  frozenRuleIds: ActiveRuleId[];
  loginVerificationEntryId: string | null;
  ruleCatalog: RuleDefinition[];
  ruleProfileConfirmed: boolean;
  verificationPending: boolean;
  entryRuntime: EntryRuntimeState;
  refreshEntries: () => Promise<void>;
  setCreatingPassword: (creating: boolean) => void;
  setCurrentSpace: (space: SpaceRecord) => void;
  setCurrentSpaceIsTemporary: (temporary: boolean) => void;
  setError: (message: string) => void;
  setLoginVerificationEntryId: (entryId: string | null) => void;
  setShowCreateForm: (value: boolean) => void;
  setStatus: (message: string) => void;
  setUiState: (state: UiState) => void;
  ensureLiveSession: (masterPassword?: string) => Promise<Session>;
  withLiveSession: <T>(
    operation: (liveSession: Session) => Promise<T>
  ) => Promise<T>;
};

export function usePasswordEntryController({
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
}: UsePasswordEntryControllerInput) {
  const {
    visibleEntryId,
    setVisibleEntryId,
    visiblePassword,
    setVisiblePassword,
    setDecryptingEntryId,
    decryptSpaceMasterPasswords,
    setDecryptSpaceMasterPasswords,
    decryptEntrySecrets,
    setDecryptEntrySecrets,
    visibleMemoryHints,
    setVisibleMemoryHints,
    viewedMemoryHintEntryIds,
    setViewedMemoryHintEntryIds,
    setMemoryHintLoadingEntryId,
    setMemoryHintSavingEntryId,
    setDecryptLoadingEntryId,
    editingEntryId,
    editingEntryDraft,
    setEditingEntryId,
    setEditingEntryDraft,
    setEditingEntryLoadingEntryId,
    setEditingEntrySavingEntryId
  } = entryRuntime;

  function ensurePolicyAllowed(
    allowed: boolean,
    fallbackMessage = "当前空间状态不允许执行此操作。"
  ) {
    if (!allowed) {
      throw new Error(
        verificationPending
          ? "当前空间已有密码，请先完成空间校验后再进行写入或修改操作。"
          : fallbackMessage
      );
    }
  }

  function policyForEntry(entry?: PasswordEntry): SpacePolicyInput {
    return {
      ...basePolicyInput,
      entryDeprecated: Boolean(entry?.deprecatedAt),
      isVerificationTarget: Boolean(
        entry && loginVerificationEntryId === entry.id
      )
    };
  }

  function canViewMemoryHint(entry: PasswordEntry) {
    return canViewMemoryHintByPolicy(policyForEntry(entry));
  }

  async function handleCreatePassword(
    input: CreatePasswordInput
  ): Promise<boolean> {
    setError("");
    setStatus("");
    setCreatingPassword(true);

    try {
      const liveSession = await ensureLiveSession(input.masterPassword);
      if (effectiveRules.length === 0) {
        throw new Error("当前没有可用规则。");
      }
      if (!ruleProfileConfirmed || frozenRuleIds.length === 0) {
        throw new Error("请先初始化并确认本次会话的规则链。");
      }
      ensurePolicyAllowed(
        canCreateEntry({ ...basePolicyInput, sessionAlive: true }),
        "当前空间不能创建密码。"
      );

      const entryId = crypto.randomUUID();
      const result = await generatePasswordWithRuleChain(
        liveSession.cryptoKey,
        input.entrySecret,
        frozenRuleIds,
        {
          mode: input.encodingMode,
          customCharset: input.customCharset,
          maxLength: input.maxLength
        },
        ruleCatalog
      );
      // 条目密码必须额外混入本次输入的 entrySecret，不能只依赖空间会话 key。
      const runtimeStorageKey = await deriveRuntimeStorageKey(
        liveSession.cryptoKey,
        input.entrySecret
      );
      const encrypted_password = await encryptPassword(
        runtimeStorageKey,
        result.encodedPassword
      );
      const encrypted_memory_hint = input.memoryHint.trim()
        ? await encryptMemoryHint(
            liveSession,
            currentSpaceId,
            entryId,
            input.memoryHint
          )
        : undefined;

      const savedSpace = await saveSpace({
        spaceId: currentSpaceId,
        status: currentSpaceStatus
      });
      await createPasswordEntry({
        id: entryId,
        spaceId: currentSpaceId,
        encrypted_password,
        encrypted_memory_hint,
        groupId: input.groupId,
        platform: input.platform,
        description: input.description
      });

      setShowCreateForm(false);
      setVisibleEntryId(null);
      setVisiblePassword("");
      setCurrentSpace(savedSpace);
      setCurrentSpaceIsTemporary(false);
      setUiState("ACTIVE");
      await refreshEntries();
      setStatus("新密码已生成并加密保存。");
      return true;
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "无法新建密码。"
      );
      return false;
    } finally {
      setCreatingPassword(false);
    }
  }

  async function handleReveal(entry: PasswordEntry) {
    setError("");
    setStatus("");
    setDecryptLoadingEntryId(entry.id);

    try {
      const liveSession = await ensureLiveSession(
        decryptSpaceMasterPasswords[entry.id]
      );
      ensurePolicyAllowed(
        canDeriveInSpace({ ...policyForEntry(entry), sessionAlive: true }),
        "当前空间不能解密或派生密码。"
      );
      if (visibleEntryId === entry.id) {
        setVisibleEntryId(null);
        setVisiblePassword("");
        setDecryptingEntryId(null);
        setDecryptSpaceMasterPasswords((current) => ({
          ...current,
          [entry.id]: ""
        }));
        setDecryptEntrySecrets((current) => ({
          ...current,
          [entry.id]: ""
        }));
        return;
      }

      // 解密路径同样临时派生条目 key；失败只提示，不修改存储数据。
      const runtimeStorageKey = await deriveRuntimeStorageKey(
        liveSession.cryptoKey,
        decryptEntrySecrets[entry.id] ?? ""
      );
      const password = await decryptPassword(
        runtimeStorageKey,
        entry.encrypted_password
      );
      setVisibleEntryId(entry.id);
      setVisiblePassword(password);
      if (loginVerificationEntryId === entry.id) {
        setLoginVerificationEntryId(null);
        setStatus("空间校验已完成。");
      }
    } catch (revealError) {
      const message = revealError instanceof Error ? revealError.message : "";
      if (message.includes("关键密钥")) {
        setError(message);
      } else if (viewedMemoryHintEntryIds[entry.id]) {
        setError(
          "仍然无法解密。你可以继续尝试其他关键密钥；如果确认无法回忆，建议前往对应平台重置密码，并将当前条目标记为废弃。"
        );
      } else if (entry.encrypted_memory_hint) {
        setError(
          "解密失败，请检查关键密钥。该条目保存了关键密钥记忆提示，你可以查看提示后重试。"
        );
      } else {
        setError("解密失败，请检查关键密钥。");
      }
    } finally {
      setDecryptLoadingEntryId(null);
    }
  }

  async function handleShowMemoryHint(entry: PasswordEntry) {
    setError("");
    setStatus("");

    if (visibleMemoryHints[entry.id]) {
      setVisibleMemoryHints((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      return;
    }

    if (!entry.encrypted_memory_hint) {
      setError("这条密码没有保存关键密钥记忆提示。");
      return;
    }
    const nextPolicy = {
      ...policyForEntry(entry),
      sessionAlive:
        basePolicyInput.sessionAlive ||
        Boolean(decryptSpaceMasterPasswords[entry.id])
    };
    if (!canViewMemoryHintByPolicy(nextPolicy)) {
      setError("空间校验完成前，只能查看待校验条目的记忆提示。");
      return;
    }

    setMemoryHintLoadingEntryId(entry.id);
    try {
      const liveSession = await ensureLiveSession(
        decryptSpaceMasterPasswords[entry.id]
      );
      const hint = await decryptMemoryHint(
        liveSession,
        currentSpaceId,
        entry.id,
        entry.encrypted_memory_hint ?? ""
      );
      setVisibleMemoryHints((current) => ({
        ...current,
        [entry.id]: hint
      }));
      setViewedMemoryHintEntryIds((current) => ({
        ...current,
        [entry.id]: true
      }));
      setStatus(
        "已显示关键密钥记忆提示，请根据提示重新输入关键密钥后再次解密。"
      );
    } catch (hintError) {
      const message = hintError instanceof Error ? hintError.message : "";
      setError(
        message.includes("过期")
          ? message
          : "记忆提示解密失败，请确认当前空间会话是否正确。"
      );
    } finally {
      setMemoryHintLoadingEntryId(null);
    }
  }

  async function handleStartEntryEdit(entry: PasswordEntry) {
    setError("");
    setStatus("");

    try {
      const entryPolicy = policyForEntry(entry);
      const canEditEntry =
        canEditEntryMetadata(entryPolicy) ||
        canEditEntryDescription(entryPolicy) ||
        canEditMemoryHint(entryPolicy);
      ensurePolicyAllowed(canEditEntry, "当前空间不能编辑这条密码。");
      if (
        editingEntryId &&
        editingEntryId !== entry.id &&
        editingEntryDraft?.dirty
      ) {
        setError("当前条目有未保存修改，请先保存或取消。");
        return;
      }

      setEditingEntryId(entry.id);
      setEditingEntryDraft({
        entryId: entry.id,
        platform: entry.platform ?? "",
        description: entry.description ?? "",
        groupId: entry.groupId ?? "",
        memoryHint: "",
        memoryHintMode: "locked",
        hasExistingMemoryHint: Boolean(entry.encrypted_memory_hint),
        memoryHintLoaded: false,
        dirty: false
      });
      setVisibleMemoryHints((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "请先完成空间校验。"
      );
    }
  }

  async function readEditingMemoryHint(
    entry: PasswordEntry,
    mode: "revealed" | "editing"
  ) {
    setError("");
    setStatus("");

    if (editingEntryId !== entry.id || !editingEntryDraft) {
      setError("请先进入这条密码的编辑状态。");
      return;
    }

    if (!entry.encrypted_memory_hint) {
      setEditingEntryDraft((current) =>
        current?.entryId === entry.id
          ? {
              ...current,
              memoryHint: "",
              memoryHintMode: "editing",
              memoryHintLoaded: true
            }
          : current
      );
      return;
    }

    if (editingEntryDraft.memoryHintLoaded) {
      setEditingEntryDraft((current) =>
        current?.entryId === entry.id
          ? {
              ...current,
              memoryHintMode: mode
            }
          : current
      );
      return;
    }

    setEditingEntryLoadingEntryId(entry.id);
    try {
      await withLiveSession(async (liveSession) => {
        const hint = await decryptMemoryHint(
          liveSession,
          currentSpaceId,
          entry.id,
          entry.encrypted_memory_hint ?? ""
        );
        setEditingEntryDraft((current) =>
          current?.entryId === entry.id
            ? {
                ...current,
                memoryHint: hint,
                memoryHintMode: mode,
                memoryHintLoaded: true
              }
            : current
        );
      });
    } catch {
      setError("记忆提示读取失败，请重新进入空间或稍后重试。");
    } finally {
      setEditingEntryLoadingEntryId(null);
    }
  }

  function handleHideEditingMemoryHint(entry: PasswordEntry) {
    setError("");
    setStatus("");
    setEditingEntryDraft((current) =>
      current?.entryId === entry.id
        ? {
            ...current,
            memoryHint: "",
            memoryHintMode: "locked",
            memoryHintLoaded: false
          }
        : current
    );
  }

  function handleCancelEntryEdit() {
    setError("");
    setStatus("");
    setEditingEntryId(null);
    setEditingEntryDraft(null);
    setEditingEntryLoadingEntryId(null);
    setEditingEntrySavingEntryId(null);
  }

  async function handleSaveEntryEdit(entry: PasswordEntry) {
    setError("");
    setStatus("");

    try {
      if (editingEntryId !== entry.id || !editingEntryDraft) {
        throw new Error("请先进入这条密码的编辑状态。");
      }
      const entryPolicy = policyForEntry(entry);
      const canEditMetadata = canEditEntryMetadata(entryPolicy);
      const canEditDescription = canEditEntryDescription(entryPolicy);
      const canEditHint = canEditMemoryHint(entryPolicy);
      ensurePolicyAllowed(
        canEditMetadata || canEditDescription || canEditHint,
        "当前空间不能编辑这条密码。"
      );

      setEditingEntrySavingEntryId(entry.id);
      await withLiveSession(async (liveSession) => {
        const patch: Parameters<typeof updatePasswordEntry>[1] = {
          platform: canEditMetadata ? editingEntryDraft.platform : undefined,
          description: canEditDescription
            ? editingEntryDraft.description
            : undefined,
          groupId: canEditDescription ? editingEntryDraft.groupId : undefined
        };
        if (
          canEditHint &&
          editingEntryDraft.memoryHintMode === "editing" &&
          editingEntryDraft.memoryHint.trim()
        ) {
          // 记忆提示使用独立 purpose 派生，不参与密码生成或解密。
          patch.encrypted_memory_hint = await encryptMemoryHint(
            liveSession,
            currentSpaceId,
            entry.id,
            editingEntryDraft.memoryHint.trim()
          );
        }
        await updatePasswordEntry(entry.id, patch);
        setVisibleMemoryHints((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
        setViewedMemoryHintEntryIds((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
        setEditingEntryId(null);
        setEditingEntryDraft(null);
        await refreshEntries();
        setStatus("条目信息已更新。");
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "无法保存条目。"
      );
    } finally {
      setEditingEntrySavingEntryId(null);
    }
  }

  async function handleClearMemoryHint(entry: PasswordEntry) {
    setError("");
    setStatus("");

    try {
      ensurePolicyAllowed(
        canEditMemoryHint(policyForEntry(entry)),
        "当前空间不能编辑记忆提示。"
      );
      if (
        !window.confirm(
          "确认清除这条密码的关键密钥记忆提示？清除后无法从本地恢复原提示。"
        )
      ) {
        return;
      }
      setMemoryHintSavingEntryId(entry.id);
      await withLiveSession(async () => {
        await updatePasswordEntry(entry.id, {
          encrypted_memory_hint: undefined
        });
        setVisibleMemoryHints((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
        setViewedMemoryHintEntryIds((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
        setEditingEntryId(null);
        setEditingEntryDraft(null);
        await refreshEntries();
        setStatus("关键密钥记忆提示已清除。");
      });
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : "无法清除记忆提示。"
      );
    } finally {
      setMemoryHintSavingEntryId(null);
    }
  }

  async function handleEntryPatch(
    entry: PasswordEntry,
    patch: { platform?: string; description?: string }
  ) {
    setError("");

    try {
      const nextPatchOnlyDescription = patch.platform === undefined;
      ensurePolicyAllowed(
        nextPatchOnlyDescription
          ? canEditEntryDescription(policyForEntry(entry))
          : canEditEntryMetadata(policyForEntry(entry)),
        "当前空间不能修改条目信息。"
      );
      await updatePasswordEntry(entry.id, {
        platform: patch.platform ?? entry.platform,
        description: patch.description ?? entry.description
      });
      await refreshEntries();
      setStatus("条目信息已更新。");
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "无法更新条目。"
      );
    }
  }

  async function handleDeprecateEntry(entry: PasswordEntry) {
    setError("");
    setStatus("");

    try {
      ensurePolicyAllowed(
        canDeprecateEntry(policyForEntry(entry)),
        "当前空间不能废弃密码。"
      );
      if (
        !window.confirm(
          "确认将这条密码标记为废弃？废弃不会删除数据，但平台名称将不能再修改。"
        )
      ) {
        return;
      }
      await updatePasswordEntry(entry.id, {
        description: entry.description,
        deprecatedAt: Date.now()
      });
      if (visibleEntryId === entry.id) {
        setVisibleEntryId(null);
        setVisiblePassword("");
      }
      if (editingEntryId === entry.id) {
        setEditingEntryId(null);
        setEditingEntryDraft(null);
      }
      await refreshEntries();
      setStatus("密码已标记为废弃。");
    } catch (deprecateError) {
      setError(
        deprecateError instanceof Error
          ? deprecateError.message
          : "无法废弃密码。"
      );
    }
  }

  return {
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
  };
}
