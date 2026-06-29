import { useEffect } from "react";
import type { PasswordEntry } from "../../storage-data";
import {
  ActionGroup,
  Button,
  CopyableSecret,
  DescriptionList,
  SelectField,
  TextareaField,
  TextField
} from "../design-system";
import { getEntryCapabilities } from "../entryCapabilities";
import type { AppController } from "../useAppController";
import { PasswordOutputAdapter } from "./PasswordOutputAdapter";

type EntryCardProps = {
  controller: AppController;
  entry: PasswordEntry;
  autoOpenVerification?: boolean;
  hideVerificationControls?: boolean;
};

export function EntryCard({
  controller,
  entry,
  autoOpenVerification = false,
  hideVerificationControls = false
}: EntryCardProps) {
  const {
    loginVerificationEntryId,
    decryptingEntryId,
    setDecryptingEntryId,
    decryptSpaceMasterPasswords,
    setDecryptSpaceMasterPasswords,
    decryptEntrySecrets,
    setDecryptEntrySecrets,
    visibleEntryId,
    setVisibleEntryId,
    visiblePassword,
    setVisiblePassword,
    passwordGroups,
    groupManagementAllowed,
    visibleMemoryHints,
    memoryHintLoadingEntryId,
    memoryHintSavingEntryId,
    decryptLoadingEntryId,
    editingEntryId,
    editingEntryDraft,
    setEditingEntryDraft,
    editingEntryLoadingEntryId,
    editingEntrySavingEntryId,
    policyForEntry,
    handleReveal,
    handleDeprecateEntry,
    handleShowMemoryHint,
    handleStartEntryEdit,
    readEditingMemoryHint,
    handleHideEditingMemoryHint,
    handleCancelEntryEdit,
    handleSaveEntryEdit,
    handleClearMemoryHint,
    handleSaveOutputPolicyToGroup
  } = controller;
  const capabilities = getEntryCapabilities(policyForEntry(entry), entry);
  const isEditing = editingEntryId === entry.id;
  const isVerificationTarget = loginVerificationEntryId === entry.id;
  const verificationControlsHidden =
    hideVerificationControls && isVerificationTarget;
  const isSavingEntry = editingEntrySavingEntryId === entry.id;
  const isLoadingEditHint = editingEntryLoadingEntryId === entry.id;
  const entryGroup = entry.groupId
    ? passwordGroups.find((group) => group.id === entry.groupId)
    : undefined;

  useEffect(() => {
    if (
      autoOpenVerification &&
      isVerificationTarget &&
      decryptingEntryId !== entry.id
    ) {
      setDecryptingEntryId(entry.id);
    }
  }, [
    autoOpenVerification,
    decryptingEntryId,
    entry.id,
    isVerificationTarget,
    setDecryptingEntryId
  ]);

  function updateDraft(patch: Partial<NonNullable<typeof editingEntryDraft>>) {
    setEditingEntryDraft((current) =>
      current?.entryId === entry.id
        ? {
            ...current,
            ...patch,
            dirty: true
          }
        : current
    );
  }

  return (
    <article
      className={
        entry.deprecatedAt ? "entry-card entry-deprecated" : "entry-card"
      }
    >
      {entry.deprecatedAt ? (
        <span className="deprecated-badge">已废弃</span>
      ) : null}

      {isEditing && editingEntryDraft ? (
        <div className="entry-edit-panel">
          <div className="entry-edit-grid">
            <TextField
              disabled={!capabilities.canEditEntryMetadata || isSavingEntry}
              label="平台"
              onChange={(event) =>
                updateDraft({ platform: event.target.value })
              }
              value={editingEntryDraft.platform}
            />
            <TextField
              disabled={!capabilities.canEditEntryDescription || isSavingEntry}
              label="普通备注"
              onChange={(event) =>
                updateDraft({ description: event.target.value })
              }
              value={editingEntryDraft.description}
            />
            <SelectField
              disabled={!capabilities.canEditEntryDescription || isSavingEntry}
              label="所属密码组"
              onChange={(event) => updateDraft({ groupId: event.target.value })}
              value={editingEntryDraft.groupId}
            >
              <option value="">不归属密码组</option>
              {passwordGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="memory-hint-field">
            <div className="memory-hint-field-header">
              <strong>关键密钥记忆提示</strong>
            </div>
            <ActionGroup className="memory-hint-actions" variant="compact">
              {editingEntryDraft.hasExistingMemoryHint &&
              editingEntryDraft.memoryHintMode === "locked" ? (
                <Button
                  disabled={!capabilities.canEditMemoryHint || isSavingEntry}
                  loading={isLoadingEditHint}
                  loadingLabel="读取中..."
                  onClick={() => void readEditingMemoryHint(entry, "revealed")}
                  size="sm"
                >
                  显示提示
                </Button>
              ) : null}
              {editingEntryDraft.memoryHintMode === "revealed" ? (
                <Button
                  disabled={isSavingEntry}
                  onClick={() => handleHideEditingMemoryHint(entry)}
                  size="sm"
                >
                  隐藏提示
                </Button>
              ) : null}
              {editingEntryDraft.memoryHintMode !== "editing" ? (
                <Button
                  disabled={!capabilities.canEditMemoryHint || isSavingEntry}
                  loading={isLoadingEditHint}
                  loadingLabel="读取中..."
                  onClick={() => void readEditingMemoryHint(entry, "editing")}
                  size="sm"
                >
                  {editingEntryDraft.hasExistingMemoryHint
                    ? "解锁编辑"
                    : "添加提示"}
                </Button>
              ) : null}
            </ActionGroup>
            {editingEntryDraft.memoryHintMode === "editing" ? (
              <TextareaField
                aria-label="关键密钥记忆提示"
                autoComplete="off"
                disabled={
                  !capabilities.canEditMemoryHint ||
                  isSavingEntry ||
                  isLoadingEditHint
                }
                label="关键密钥记忆提示"
                onChange={(event) =>
                  updateDraft({ memoryHint: event.target.value })
                }
                placeholder="不要填写关键密钥本身，也不要填写完整生成规则"
                value={editingEntryDraft.memoryHint}
              />
            ) : (
              <div className="masked-memory-hint" aria-label="关键密钥记忆提示">
                {editingEntryDraft.memoryHintMode === "revealed"
                  ? editingEntryDraft.memoryHint
                  : editingEntryDraft.hasExistingMemoryHint
                    ? "••••••••"
                    : "未保存提示"}
              </div>
            )}
          </div>
          {isLoadingEditHint ? (
            <p className="field-note">正在读取已保存的记忆提示...</p>
          ) : null}
          <ActionGroup variant="entry">
            <Button
              disabled={isLoadingEditHint}
              loading={isSavingEntry}
              loadingLabel="保存中..."
              onClick={() => void handleSaveEntryEdit(entry)}
            >
              保存条目
            </Button>
            {editingEntryDraft.hasExistingMemoryHint &&
            editingEntryDraft.memoryHintMode === "editing" ? (
              <Button
                disabled={isSavingEntry}
                loading={memoryHintSavingEntryId === entry.id}
                loadingLabel="清除中..."
                onClick={() => void handleClearMemoryHint(entry)}
              >
                清除提示
              </Button>
            ) : null}
            <Button disabled={isSavingEntry} onClick={handleCancelEntryEdit}>
              取消编辑
            </Button>
          </ActionGroup>
        </div>
      ) : (
        <DescriptionList
          items={[
            { label: "平台", value: entry.platform ?? "未填写" },
            { label: "普通备注", value: entry.description ?? "未填写" },
            { label: "密码组", value: entryGroup?.name ?? "未归组" }
          ]}
        />
      )}

      {decryptingEntryId === entry.id &&
      !isEditing &&
      !verificationControlsHidden ? (
        <div className="decrypt-fields">
          {isVerificationTarget ? (
            <TextField
              autoComplete="current-password"
              className="decrypt-secret-field"
              label="空间主密码"
              onChange={(event) =>
                setDecryptSpaceMasterPasswords((current) => ({
                  ...current,
                  [entry.id]: event.target.value
                }))
              }
              type="password"
              value={decryptSpaceMasterPasswords[entry.id] ?? ""}
            />
          ) : null}
          <TextField
            autoComplete="off"
            className="decrypt-secret-field"
            label="解密关键密钥"
            onChange={(event) =>
              setDecryptEntrySecrets((current) => ({
                ...current,
                [entry.id]: event.target.value
              }))
            }
            value={decryptEntrySecrets[entry.id] ?? ""}
          />
        </div>
      ) : null}
      {!isEditing && visibleMemoryHints[entry.id] ? (
        <div className="memory-hint-box">
          <strong>关键密钥记忆提示：</strong>
          <span>{visibleMemoryHints[entry.id]}</span>
          <small>请根据提示重新输入关键密钥后再次解密。</small>
        </div>
      ) : null}
      <CopyableSecret
        className={
          isEditing ? "entry-secret entry-secret-editing" : "entry-secret"
        }
        disabled={isEditing || visibleEntryId !== entry.id}
        label={
          isEditing
            ? "密码内容"
            : visibleEntryId === entry.id
              ? "已解密核心密码"
              : "密码状态"
        }
        value={
          isEditing
            ? "当前不支持编辑密码"
            : visibleEntryId === entry.id
              ? visiblePassword
              : "加密密码"
        }
      />
      {!isEditing && visibleEntryId === entry.id ? (
        <PasswordOutputAdapter
          corePassword={visiblePassword}
          group={entryGroup}
          groupManagementAllowed={groupManagementAllowed}
          onSaveGroupPolicy={handleSaveOutputPolicyToGroup}
        />
      ) : null}
      {!capabilities.canEditEntry && capabilities.disabledReason ? (
        <p className="field-note">{capabilities.disabledReason}</p>
      ) : null}
      {!isEditing ? (
        <ActionGroup variant="entry">
          {!verificationControlsHidden ? (
            <Button
              disabled={!capabilities.canDecrypt && !isVerificationTarget}
              loading={decryptLoadingEntryId === entry.id}
              loadingLabel="解密中..."
              onClick={() => {
                if (decryptingEntryId !== entry.id) {
                  setDecryptingEntryId(entry.id);
                  setVisibleEntryId(null);
                  setVisiblePassword("");
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
                void handleReveal(entry);
              }}
            >
              {visibleEntryId === entry.id
                ? "隐藏"
                : decryptingEntryId === entry.id
                  ? isVerificationTarget
                    ? "完成空间校验"
                    : "确认解密"
                  : isVerificationTarget
                    ? "校验空间"
                    : "解密"}
            </Button>
          ) : null}
          <Button
            disabled={!capabilities.canDeprecate}
            onClick={() => void handleDeprecateEntry(entry)}
          >
            废弃
          </Button>
          {entry.encrypted_memory_hint && !verificationControlsHidden ? (
            <Button
              disabled={!capabilities.canViewMemoryHint}
              loading={memoryHintLoadingEntryId === entry.id}
              loadingLabel="读取中..."
              onClick={() => void handleShowMemoryHint(entry)}
            >
              {visibleMemoryHints[entry.id] ? "隐藏记忆提示" : "查看记忆提示"}
            </Button>
          ) : null}
          <Button
            disabled={
              !capabilities.canEditEntry || isSavingEntry || isLoadingEditHint
            }
            onClick={() => void handleStartEntryEdit(entry)}
          >
            编辑条目
          </Button>
          <Button disabled>删除</Button>
        </ActionGroup>
      ) : null}
    </article>
  );
}
