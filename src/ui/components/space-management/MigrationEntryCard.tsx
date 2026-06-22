import type {
  MigrationEntry,
  MigrationMode
} from "../../../storage-engine/storage-engine";
import {
  ActionGroup,
  Button,
  CheckboxField,
  DescriptionList,
  SelectField,
  TextField
} from "../../design-system";
import { Notice } from "../../notifications/Notice";
import type { AppController } from "../../useAppController";

type MigrationEntryCardProps = {
  controller: AppController;
  entry: MigrationEntry;
  batchIsDraft: boolean;
  migrationAllowed: boolean;
  mode: MigrationMode;
  oldEntrySecret: string;
  newEntrySecret: string;
  reuseOldEntrySecret: boolean;
  externalPasswordUpdated: boolean;
  setMode: (mode: MigrationMode) => void;
  setOldEntrySecret: (value: string) => void;
  setNewEntrySecret: (value: string) => void;
  setReuseOldEntrySecret: (value: boolean) => void;
  setExternalPasswordUpdated: (value: boolean) => void;
};

export function MigrationEntryCard({
  controller,
  entry,
  batchIsDraft,
  migrationAllowed,
  mode,
  oldEntrySecret,
  newEntrySecret,
  reuseOldEntrySecret,
  externalPasswordUpdated,
  setMode,
  setOldEntrySecret,
  setNewEntrySecret,
  setReuseOldEntrySecret,
  setExternalPasswordUpdated
}: MigrationEntryCardProps) {
  const {
    handleMigrateEntry,
    handleSkipMigrationEntry,
    sourceSessionVerified
  } = controller;
  const feedback = controller.migrationEntryFeedbacks[entry.id];
  const migrated = entry.status !== "pending";
  const draftDisabledReason = controller.ruleProfileConfirmed
    ? "迁移批次正在根据目标规则链自动进入就绪状态，请稍候。"
    : "请先在规则管理页确认初始化目标空间规则链，系统会在初始化后自动开启迁移。";
  const migrationDisabledReason = migrated
    ? ""
    : batchIsDraft
      ? draftDisabledReason
      : !migrationAllowed
        ? "请先完成目标空间会话、空间校验和规则链初始化。"
        : !sourceSessionVerified
          ? "请先完成来源空间校验。"
          : "";
  const skipDisabledReason = migrated
    ? ""
    : batchIsDraft
      ? draftDisabledReason
      : !migrationAllowed
        ? "请先完成目标空间会话、空间校验和规则链初始化。"
        : "";
  const entryDisabledReason = migrationDisabledReason || skipDisabledReason;

  return (
    <article
      className={[
        entry.sourceDeprecatedAt ? "entry-card entry-deprecated" : "entry-card",
        migrated ? "migration-entry-complete" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {entry.sourceDeprecatedAt ? (
        <span className="deprecated-badge">来源已废弃</span>
      ) : null}
      <DescriptionList
        items={[
          { label: "平台", value: entry.platform ?? "未填写" },
          { label: "普通备注", value: entry.description ?? "未填写" },
          {
            label: "迁移状态",
            value:
              entry.status === "migrated"
                ? "已迁移"
                : entry.status === "skipped"
                  ? "已跳过"
                  : "待迁移"
          }
        ]}
      />
      {!migrated ? (
        <div className="entry-edit-panel">
          <SelectField
            label="迁移模式"
            onChange={(event) => setMode(event.target.value as MigrationMode)}
            value={mode}
          >
            <option value="preserve_password">保持平台密码不变</option>
            <option value="regenerate_password">按新规则重新生成</option>
          </SelectField>
          <TextField
            autoComplete="off"
            label="旧关键密钥"
            onChange={(event) => setOldEntrySecret(event.target.value)}
            value={oldEntrySecret}
          />
          <CheckboxField
            checked={reuseOldEntrySecret}
            className="rule-choice"
            label={<span>复用旧关键密钥作为新关键密钥</span>}
            onChange={(event) => setReuseOldEntrySecret(event.target.checked)}
          />
          {!reuseOldEntrySecret ? (
            <TextField
              autoComplete="off"
              label="新关键密钥"
              onChange={(event) => setNewEntrySecret(event.target.value)}
              value={newEntrySecret}
            />
          ) : null}
          {mode === "regenerate_password" ? (
            <CheckboxField
              checked={externalPasswordUpdated}
              className="rule-choice"
              label={<span>我已在外部平台更新为重新生成的新密码</span>}
              onChange={(event) =>
                setExternalPasswordUpdated(event.target.checked)
              }
            />
          ) : null}
          {mode === "regenerate_password" ? (
            <p className="field-note">
              重新生成模式会改变平台密码，必须先更新外部平台后才会落盘。
            </p>
          ) : null}
          {entryDisabledReason ? (
            <p className="field-note">{entryDisabledReason}</p>
          ) : null}
          <ActionGroup variant="entry">
            <Button
              disabled={Boolean(migrationDisabledReason)}
              onClick={() => void handleMigrateEntry(entry)}
            >
              执行迁移
            </Button>
            <Button
              disabled={Boolean(skipDisabledReason)}
              onClick={() => void handleSkipMigrationEntry(entry)}
            >
              跳过
            </Button>
          </ActionGroup>
        </div>
      ) : null}
      {feedback ? (
        <Notice
          className="entry-feedback"
          notice={{
            scope: "section",
            tone: feedback.tone,
            title: feedback.title,
            body: feedback.body
          }}
        />
      ) : null}
    </article>
  );
}
