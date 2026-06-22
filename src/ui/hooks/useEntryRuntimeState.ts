import { useCallback, useState } from "react";

export type EditingEntryDraft = {
  entryId: string;
  platform: string;
  description: string;
  groupId: string;
  memoryHint: string;
  memoryHintMode: "locked" | "revealed" | "editing";
  hasExistingMemoryHint: boolean;
  memoryHintLoaded: boolean;
  dirty: boolean;
};

export function useEntryRuntimeState() {
  // 这里只保存 UI 运行时状态，不承载可持久化的密码派生输入。
  const [visibleEntryId, setVisibleEntryId] = useState<string | null>(null);
  const [visiblePassword, setVisiblePassword] = useState("");
  const [decryptingEntryId, setDecryptingEntryId] = useState<string | null>(null);
  const [decryptSpaceMasterPasswords, setDecryptSpaceMasterPasswords] = useState<Record<string, string>>({});
  const [decryptEntrySecrets, setDecryptEntrySecrets] = useState<Record<string, string>>({});
  const [visibleMemoryHints, setVisibleMemoryHints] = useState<Record<string, string>>({});
  const [viewedMemoryHintEntryIds, setViewedMemoryHintEntryIds] = useState<Record<string, boolean>>({});
  const [memoryHintLoadingEntryId, setMemoryHintLoadingEntryId] = useState<string | null>(null);
  const [editingMemoryHintEntryId, setEditingMemoryHintEntryId] = useState<string | null>(null);
  const [memoryHintEditValue, setMemoryHintEditValue] = useState("");
  const [memoryHintSavingEntryId, setMemoryHintSavingEntryId] = useState<string | null>(null);
  const [decryptLoadingEntryId, setDecryptLoadingEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryDraft, setEditingEntryDraft] = useState<EditingEntryDraft | null>(null);
  const [editingEntryLoadingEntryId, setEditingEntryLoadingEntryId] = useState<string | null>(null);
  const [editingEntrySavingEntryId, setEditingEntrySavingEntryId] = useState<string | null>(null);

  const clearEntryRuntimeState = useCallback(() => {
    setVisibleEntryId(null);
    setVisiblePassword("");
    setDecryptingEntryId(null);
    setDecryptLoadingEntryId(null);
    setDecryptSpaceMasterPasswords({});
    setDecryptEntrySecrets({});
    setVisibleMemoryHints({});
    setViewedMemoryHintEntryIds({});
    setMemoryHintLoadingEntryId(null);
    setEditingMemoryHintEntryId(null);
    setMemoryHintEditValue("");
    setMemoryHintSavingEntryId(null);
    setEditingEntryId(null);
    setEditingEntryDraft(null);
    setEditingEntryLoadingEntryId(null);
    setEditingEntrySavingEntryId(null);
  }, []);

  return {
    visibleEntryId,
    setVisibleEntryId,
    visiblePassword,
    setVisiblePassword,
    decryptingEntryId,
    setDecryptingEntryId,
    decryptSpaceMasterPasswords,
    setDecryptSpaceMasterPasswords,
    decryptEntrySecrets,
    setDecryptEntrySecrets,
    visibleMemoryHints,
    setVisibleMemoryHints,
    viewedMemoryHintEntryIds,
    setViewedMemoryHintEntryIds,
    memoryHintLoadingEntryId,
    setMemoryHintLoadingEntryId,
    editingMemoryHintEntryId,
    setEditingMemoryHintEntryId,
    memoryHintEditValue,
    setMemoryHintEditValue,
    memoryHintSavingEntryId,
    setMemoryHintSavingEntryId,
    decryptLoadingEntryId,
    setDecryptLoadingEntryId,
    editingEntryId,
    setEditingEntryId,
    editingEntryDraft,
    setEditingEntryDraft,
    editingEntryLoadingEntryId,
    setEditingEntryLoadingEntryId,
    editingEntrySavingEntryId,
    setEditingEntrySavingEntryId,
    clearEntryRuntimeState
  };
}
