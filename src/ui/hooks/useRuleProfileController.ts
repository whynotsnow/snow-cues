import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  availableRules,
  createImportedRule,
  parseImportedRuleManifest,
  type ActiveRuleId,
  type ImportedRuleManifest,
  type RuleDefinition
} from "../../rule-registry/rules";
import {
  saveSpace,
  saveSpaceProfile,
  type SpaceRecord
} from "../../storage-engine/storage-engine";
import { canEditRuleProfile } from "../../space/policy";
import type { SpacePolicyInput } from "../../space/types";
import {
  DEFAULT_RULE_CHAIN,
  DEFAULT_RULE_ID,
  type AppPage,
  type ImportedRuleState
} from "../appTypes";

type UseRuleProfileControllerInput = {
  basePolicyInput: SpacePolicyInput;
  currentSpaceId: string;
  currentSpaceStatus: SpaceRecord["status"];
  ruleProfileConfirmed: boolean;
  sessionAlive: boolean;
  verificationPending: boolean;
  setActivePage: (page: AppPage) => void;
  setCurrentSpace: (space: SpaceRecord) => void;
  setCurrentSpaceIsTemporary: (temporary: boolean) => void;
  setError: (message: string) => void;
  setRuleProfileConfirmed: (confirmed: boolean) => void;
  setShowCreateForm: (value: boolean) => void;
  setStatus: (message: string) => void;
  ensureLiveSession: (masterPassword?: string) => Promise<unknown>;
};

export function useRuleProfileController({
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
}: UseRuleProfileControllerInput) {
  const [draftRuleIds, setDraftRuleIds] =
    useState<ActiveRuleId[]>(DEFAULT_RULE_CHAIN);
  const [frozenRuleIds, setFrozenRuleIds] = useState<ActiveRuleId[]>([]);
  const [importedRules, setImportedRules] = useState<ImportedRuleState[]>([]);
  const [ruleImportText, setRuleImportText] = useState("");
  const [confirmingProfile, setConfirmingProfile] = useState(false);

  const availableRuleOptions = useMemo(
    () => [
      ...availableRules,
      ...importedRules
        .filter((rule) => rule.enabled)
        .map((rule) => rule.definition)
    ],
    [importedRules]
  );
  const ruleCatalog = useMemo(
    () => [...availableRules, ...importedRules.map((rule) => rule.definition)],
    [importedRules]
  );
  const frozenRules = useMemo(
    () =>
      frozenRuleIds
        .map((id) => ruleCatalog.find((rule) => rule.id === id))
        .filter((rule): rule is RuleDefinition => Boolean(rule)),
    [frozenRuleIds, ruleCatalog]
  );
  const draftRules = useMemo(
    () =>
      draftRuleIds
        .map((id) => ruleCatalog.find((rule) => rule.id === id))
        .filter((rule): rule is RuleDefinition => Boolean(rule)),
    [draftRuleIds, ruleCatalog]
  );
  const effectiveRules = ruleProfileConfirmed ? frozenRules : draftRules;
  const draftRuleProfileAllowed = canEditRuleProfile({
    ...basePolicyInput,
    sessionAlive: true
  });
  const editRuleProfileAllowed = canEditRuleProfile(basePolicyInput);
  const confirmRuleProfileAllowed =
    draftRuleProfileAllowed && !ruleProfileConfirmed;

  function ensureRulePolicyAllowed(
    fallbackMessage = "当前空间不能导入或修改规则。"
  ) {
    if (!draftRuleProfileAllowed) {
      throw new Error(
        verificationPending
          ? "当前空间已有密码，请先完成空间校验后再进行写入或修改操作。"
          : fallbackMessage
      );
    }
  }

  const resetRuleProfile = useCallback(() => {
    setImportedRules([]);
    setDraftRuleIds(DEFAULT_RULE_CHAIN);
    setFrozenRuleIds([]);
    setRuleProfileConfirmed(false);
  }, [setRuleProfileConfirmed]);

  const applyPersistedProfile = useCallback(
    (profileRuleIds: ActiveRuleId[], manifests: ImportedRuleManifest[]) => {
      // 恢复空间 profile 时只重建声明式导入规则，规则链随后作为冻结配置使用。
      const restoredRules = manifests.map((manifest) => ({
        manifest,
        definition: createImportedRule(manifest),
        enabled: true
      }));
      setImportedRules(restoredRules);
      setDraftRuleIds(profileRuleIds);
      setFrozenRuleIds(profileRuleIds);
      setRuleProfileConfirmed(true);
    },
    [setRuleProfileConfirmed]
  );

  const applyDraftProfile = useCallback(
    (profileRuleIds: ActiveRuleId[], manifests: ImportedRuleManifest[]) => {
      const restoredRules = manifests.map((manifest) => ({
        manifest,
        definition: createImportedRule(manifest),
        enabled: true
      }));
      setImportedRules(restoredRules);
      setDraftRuleIds(
        profileRuleIds.length > 0 ? profileRuleIds : DEFAULT_RULE_CHAIN
      );
      setFrozenRuleIds([]);
      setRuleProfileConfirmed(false);
    },
    [setRuleProfileConfirmed]
  );

  useEffect(() => {
    // 可用规则变化时修剪草稿链；已冻结规则缺失则只提示，不自动替换。
    const availableIds = new Set(availableRuleOptions.map((rule) => rule.id));
    setDraftRuleIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length > 0 ? next : [DEFAULT_RULE_ID];
    });
    if (!ruleProfileConfirmed) {
      return;
    }
    if (
      !frozenRuleIds.every((id) => ruleCatalog.some((rule) => rule.id === id))
    ) {
      setError("当前规则链缺少规则定义，请重新进入空间并按原规则初始化。");
    }
  }, [
    availableRuleOptions,
    frozenRuleIds,
    ruleCatalog,
    ruleProfileConfirmed,
    setError
  ]);

  function parseRuleImportText(): ImportedRuleManifest[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(ruleImportText);
    } catch {
      return [parseImportedRuleManifest(ruleImportText)];
    }

    const manifestInputs = Array.isArray(parsed) ? parsed : [parsed];
    return manifestInputs.map((manifestInput) =>
      parseImportedRuleManifest(JSON.stringify(manifestInput))
    );
  }

  function handleImportRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    try {
      ensureRulePolicyAllowed("当前空间不能导入或修改规则。");
      if (ruleProfileConfirmed) {
        throw new Error("规则链已初始化，本次会话内不再导入新规则。");
      }
      const manifests = parseRuleImportText();
      // 导入阶段先做 ID 去重，避免同名规则进入本次初始化候选集。
      const existingIds = new Set([
        ...availableRules.map((rule) => rule.id),
        ...importedRules.map((rule) => rule.manifest.id)
      ]);
      const importingIds = new Set<string>();
      for (const manifest of manifests) {
        if (existingIds.has(manifest.id) || importingIds.has(manifest.id)) {
          throw new Error(`同名规则已经生效：${manifest.id}`);
        }
        importingIds.add(manifest.id);
      }

      const nextRules = manifests.map((manifest) => ({
        manifest,
        definition: createImportedRule(manifest),
        enabled: true
      }));
      setImportedRules((current) => [...current, ...nextRules]);
      setRuleImportText("");
      setStatus(`已导入 ${nextRules.length} 条规则，初始化前可加入规则链。`);
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "无法导入规则。"
      );
    }
  }

  function handleImportedRuleToggle(id: string) {
    try {
      ensureRulePolicyAllowed("当前空间不能修改规则。");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "请先完成空间校验。"
      );
      return;
    }
    if (ruleProfileConfirmed) {
      setError(
        "规则链已初始化。为保持已有密码可追溯，本次会话内不再变更规则启用状态。"
      );
      return;
    }
    setImportedRules((current) =>
      current.map((item) =>
        item.manifest.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
    setDraftRuleIds((current) => current.filter((ruleId) => ruleId !== id));
  }

  function handleImportedRuleNameChange(id: string, name: string) {
    try {
      ensureRulePolicyAllowed("当前空间不能修改规则。");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "请先完成空间校验。"
      );
      return;
    }
    if (ruleProfileConfirmed) {
      setError("规则链已初始化，规则名称不再变更。");
      return;
    }
    setImportedRules((current) =>
      current.map((item) => {
        if (item.manifest.id !== id) {
          return item;
        }
        const nextManifest = parseImportedRuleManifest(
          JSON.stringify({
            ...item.manifest,
            name
          })
        );
        return {
          ...item,
          manifest: nextManifest,
          definition: createImportedRule(nextManifest)
        };
      })
    );
  }

  function handleImportedRuleDelete(id: string) {
    try {
      ensureRulePolicyAllowed("当前空间不能删除规则。");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "请先完成空间校验。"
      );
      return;
    }
    if (ruleProfileConfirmed) {
      setError(
        "规则链已初始化。为保持已有密码可追溯，本次会话内不再删除规则。"
      );
      return;
    }
    if (
      !window.confirm(
        "确认删除这条导入规则？未初始化前删除不会影响已保存密码。"
      )
    ) {
      return;
    }
    setImportedRules((current) =>
      current.filter((item) => item.manifest.id !== id)
    );
    setDraftRuleIds((current) => current.filter((ruleId) => ruleId !== id));
  }

  function handleDraftRuleToggle(ruleId: ActiveRuleId) {
    try {
      ensureRulePolicyAllowed("当前空间不能修改规则链。");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "请先完成空间校验。"
      );
      return;
    }
    if (ruleProfileConfirmed) {
      setError("规则链已初始化。后续新建密码会继续使用已确认的规则链。");
      return;
    }
    setDraftRuleIds((current) => {
      if (current.includes(ruleId)) {
        return current.filter((id) => id !== ruleId);
      }
      return [...current, ruleId];
    });
  }

  async function handleConfirmRuleProfile(masterPassword?: string) {
    setError("");
    setStatus("");
    setConfirmingProfile(true);
    try {
      ensureRulePolicyAllowed("当前空间不能初始化规则链。");
      if (!sessionAlive) {
        await ensureLiveSession(masterPassword);
      }
      const normalizedRuleIds = draftRuleIds.filter(
        (id, index) => draftRuleIds.indexOf(id) === index
      );
      if (normalizedRuleIds.length === 0) {
        setError("请至少选择一个规则后再初始化。");
        return;
      }
      if (
        !window.confirm(
          "确认初始化规则链？初始化后本空间会冻结这组规则链，本次会话内不能再导入、停用、重命名或删除参与规则。"
        )
      ) {
        return false;
      }
      const selectedImportedManifests = importedRules
        .filter((rule) => normalizedRuleIds.includes(rule.manifest.id))
        .map((rule) => rule.manifest);
      const savedSpace = await saveSpace({
        spaceId: currentSpaceId,
        status: currentSpaceStatus
      });
      await saveSpaceProfile({
        spaceId: currentSpaceId,
        ruleChain: normalizedRuleIds,
        importedRuleManifests: selectedImportedManifests
      });
      // 初始化后冻结规则链，后续新建密码只读 frozenRuleIds。
      setFrozenRuleIds(normalizedRuleIds);
      setRuleProfileConfirmed(true);
      setCurrentSpace(savedSpace);
      setCurrentSpaceIsTemporary(false);
      setShowCreateForm(false);
      setActivePage("passwords");
      setStatus("规则链已初始化并保存。本空间后续进入会继续使用这组规则。");
      return true;
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "无法保存存储空间规则链配置。"
      );
      return false;
    } finally {
      setConfirmingProfile(false);
    }
  }

  return {
    draftRuleIds,
    setDraftRuleIds,
    frozenRuleIds,
    setFrozenRuleIds,
    importedRules,
    setImportedRules,
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
  };
}
