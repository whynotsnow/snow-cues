import {
  formatMigrationBatchStatus,
  formatMigrationRuleSnapshot
} from "../../displayLabels";
import {
  ActionGroup,
  Button,
  Card,
  CheckboxField,
  SectionHeader,
  SelectField,
  TextField
} from "../../design-system";
import { EntryVerificationPanel } from "../EntryVerificationPanel";
import type { AppController } from "../../useAppController";
import { MigrationEntryCard } from "./MigrationEntryCard";

type SpaceMigrationCardProps = {
  controller: AppController;
  doneCount: number;
  pendingCount: number;
  totalCount: number;
};

export function SpaceMigrationCard({
  controller,
  doneCount,
  pendingCount,
  totalCount
}: SpaceMigrationCardProps) {
  const {
    migrationBatches,
    migrationEntries,
    selectedMigrationBatch,
    selectedMigrationBatchId,
    setSelectedMigrationBatchId,
    sourceMasterPassword,
    setSourceMasterPassword,
    sourceSessionVerified,
    sourceSessionVerifying,
    sourceVerificationFeedback,
    sourceVerificationFeedbackTone,
    sourceVerificationEntryId,
    setSourceVerificationEntryId,
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
    migrationAllowed,
    handleMigrationAutoFinalizeChange,
    handleFinalizeMigrationBatch,
    handleVerifySourceSession
  } = controller;

  if (migrationBatches.length === 0) {
    return null;
  }

  const pendingMigrationEntries = migrationEntries.filter(
    (entry) => entry.status === "pending"
  );
  const allMigrationEntriesHandled =
    migrationEntries.length > 0 && pendingMigrationEntries.length === 0;
  const sourceFinalized = Boolean(selectedMigrationBatch?.sourceFinalizedAt);
  const hideCompletedAutoFinalizedBatch = Boolean(
    selectedMigrationBatch &&
    allMigrationEntriesHandled &&
    selectedMigrationBatch.autoFinalizeSource
  );

  if (hideCompletedAutoFinalizedBatch) {
    return null;
  }

  const sourceVerificationEntry =
    pendingMigrationEntries.find(
      (entry) => entry.id === sourceVerificationEntryId
    ) ??
    pendingMigrationEntries[0] ??
    null;
  const batchIsDraft = selectedMigrationBatch?.status === "draft";
  const flowPreferenceLocked = Boolean(
    selectedMigrationBatch &&
    (selectedMigrationBatch.status === "in_progress" ||
      selectedMigrationBatch.status === "completed" ||
      selectedMigrationBatch.sourceFinalizedAt)
  );
  const canManuallyFinalizeSource = Boolean(
    selectedMigrationBatch &&
    selectedMigrationBatch.status === "completed" &&
    !sourceFinalized
  );
  const migrationEntriesAllowed = migrationAllowed && !batchIsDraft;
  const migrationSummary =
    totalCount > 0
      ? allMigrationEntriesHandled
        ? "迁移条目已全部处理完成。"
        : `迁移未完成 / 已迁移 ${doneCount} 条 / 剩余 ${pendingCount} 条`
      : "当前空间没有待迁移条目。";

  return (
    <Card aria-label="迁移情况">
      <SectionHeader description={migrationSummary} title="迁移情况" />
      {migrationBatches.length > 0 ? (
        <SelectField
          label="迁移批次"
          onChange={(event) => setSelectedMigrationBatchId(event.target.value)}
          value={selectedMigrationBatchId}
        >
          {migrationBatches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.sourceSpaceId} → {batch.targetSpaceId} ·{" "}
              {formatMigrationBatchStatus(batch.status)}
            </option>
          ))}
        </SelectField>
      ) : null}
      {selectedMigrationBatch ? (
        <div className="effective-rule">
          <span>来源规则快照</span>
          <strong>
            {formatMigrationRuleSnapshot(
              selectedMigrationBatch.sourceProfileSnapshot
            )}
          </strong>
          <small>
            来源规则只读，用于理解旧空间；目标规则初始化后用于重新生成模式。
          </small>
        </div>
      ) : null}
      {selectedMigrationBatch ? (
        <div className="migration-flow-options">
          <CheckboxField
            checked={selectedMigrationBatch.autoFinalizeSource}
            className="rule-choice"
            disabled={flowPreferenceLocked}
            label={
              <span>
                <strong>迁移完成后自动流转来源空间状态</strong>
                <small>
                  默认开启。关闭后，全部条目迁移或跳过完成时不会自动创建接替关系，也不会自动把来源空间标记为历史空间。
                </small>
              </span>
            }
            onChange={(event) =>
              void handleMigrationAutoFinalizeChange(event.target.checked)
            }
          />
          {flowPreferenceLocked && !selectedMigrationBatch.sourceFinalizedAt ? (
            <p className="field-note">
              迁移已开始或已完成，流转方式不能再修改。
            </p>
          ) : null}
          {selectedMigrationBatch.sourceFinalizedAt ? (
            <p className="login-note">
              来源空间状态已完成流转，并已记录接替关系。
            </p>
          ) : null}
          {canManuallyFinalizeSource ? (
            <ActionGroup variant="tool">
              <Button onClick={() => void handleFinalizeMigrationBatch()}>
                手动流转来源空间状态
              </Button>
            </ActionGroup>
          ) : null}
          {sourceFinalized && !selectedMigrationBatch.autoFinalizeSource ? (
            <ActionGroup variant="tool">
              <Button disabled>来源空间状态已流转</Button>
            </ActionGroup>
          ) : null}
        </div>
      ) : null}
      {allMigrationEntriesHandled ? (
        <div className="effective-rule">
          <span>迁移条目</span>
          <strong>已全部处理完成</strong>
          <small>
            {sourceFinalized
              ? "来源空间状态已流转，迁移条目详情已收起。"
              : "迁移条目详情已收起；如选择手动流转，请在上方完成来源空间状态流转。"}
          </small>
        </div>
      ) : null}
      {!allMigrationEntriesHandled &&
      selectedMigrationBatch &&
      (sourceSessionVerified || sourceVerificationEntry) ? (
        <EntryVerificationPanel
          title="来源空间校验"
          description="选择一条旧空间密码，用旧空间主密码和这条密码的旧关键密钥完成来源空间校验。"
          entries={pendingMigrationEntries}
          selectedEntryId={
            sourceVerificationEntry?.id ?? sourceVerificationEntryId
          }
          selectLabel="用于校验的旧密码条目"
          onSelectEntry={setSourceVerificationEntryId}
          disabled={sourceSessionVerifying}
          verified={sourceSessionVerified}
          successDescription="来源空间已完成校验。本次会话内迁移条目时，只需要为每条密码填写对应的旧关键密钥。"
          successNote="来源空间已校验，可以继续执行迁移或跳过不需要迁移的条目。"
          feedback={
            sourceVerificationFeedback
              ? {
                  tone: sourceVerificationFeedbackTone,
                  title:
                    sourceVerificationFeedbackTone === "error"
                      ? "来源空间校验失败"
                      : sourceVerificationFeedbackTone === "success"
                        ? "来源空间校验完成"
                        : "正在校验来源空间",
                  body: sourceVerificationFeedback
                }
              : undefined
          }
          submitLabel="校验来源空间"
          submittingLabel="校验中..."
          submitting={sourceSessionVerifying}
          onSubmit={() => void handleVerifySourceSession()}
        >
          <TextField
            autoComplete="current-password"
            disabled={sourceSessionVerifying}
            label="旧空间主密码"
            onChange={(event) => setSourceMasterPassword(event.target.value)}
            type="password"
            value={sourceMasterPassword}
          />
          {sourceVerificationEntry ? (
            <TextField
              autoComplete="off"
              disabled={sourceSessionVerifying}
              label="旧关键密钥"
              onChange={(event) =>
                setOldEntrySecrets((current) => ({
                  ...current,
                  [sourceVerificationEntry.id]: event.target.value
                }))
              }
              value={oldEntrySecrets[sourceVerificationEntry.id] ?? ""}
            />
          ) : null}
        </EntryVerificationPanel>
      ) : null}
      {!allMigrationEntriesHandled ? (
        <div className="entries-grid">
          {migrationEntries.map((entry) => (
            <MigrationEntryCard
              controller={controller}
              entry={entry}
              key={entry.id}
              batchIsDraft={batchIsDraft}
              migrationAllowed={migrationEntriesAllowed}
              mode={migrationModes[entry.id] ?? "preserve_password"}
              oldEntrySecret={oldEntrySecrets[entry.id] ?? ""}
              newEntrySecret={newEntrySecrets[entry.id] ?? ""}
              reuseOldEntrySecret={Boolean(reuseOldEntrySecret[entry.id])}
              externalPasswordUpdated={Boolean(
                externalPasswordUpdated[entry.id]
              )}
              setMode={(mode) =>
                setMigrationModes((current) => ({
                  ...current,
                  [entry.id]: mode
                }))
              }
              setOldEntrySecret={(value) =>
                setOldEntrySecrets((current) => ({
                  ...current,
                  [entry.id]: value
                }))
              }
              setNewEntrySecret={(value) =>
                setNewEntrySecrets((current) => ({
                  ...current,
                  [entry.id]: value
                }))
              }
              setReuseOldEntrySecret={(value) =>
                setReuseOldEntrySecret((current) => ({
                  ...current,
                  [entry.id]: value
                }))
              }
              setExternalPasswordUpdated={(value) =>
                setExternalPasswordUpdated((current) => ({
                  ...current,
                  [entry.id]: value
                }))
              }
            />
          ))}
        </div>
      ) : null}
      {lastMigratedPassword ? (
        <div className="memory-hint-box">
          <strong>本次迁移得到的平台密码：</strong>
          <span>{lastMigratedPassword}</span>
          <small>
            该明文只保存在当前界面状态中，离开空间或刷新后不会保留。
          </small>
        </div>
      ) : null}
    </Card>
  );
}
