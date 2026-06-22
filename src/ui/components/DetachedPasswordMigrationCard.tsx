import type { FormEvent } from "react";
import { useEffect } from "react";
import {
  ActionGroup,
  Button,
  Card,
  SectionHeader,
  SelectField,
  TextField
} from "../design-system";
import { useCreatePasswordForm } from "../hooks/useCreatePasswordForm";
import type { AppController } from "../useAppController";

type DetachedPasswordMigrationCardProps = {
  controller: AppController;
};

export function DetachedPasswordMigrationCard({
  controller
}: DetachedPasswordMigrationCardProps) {
  const {
    pendingDetachedEntrySecret,
    detachedMigrationFormVisible,
    setDetachedMigrationFormVisible,
    ruleProfileConfirmed,
    verificationPending,
    createEntryAllowed,
    creatingPassword,
    sessionAlive,
    currentSpaceIsTemporary,
    passwordGroups,
    handleCreatePassword,
    handleCancelDetachedPasswordMigration,
    clearDetachedPasswordAfterSave
  } = controller;
  const form = useCreatePasswordForm();
  const { values, actions } = form;
  const needsSpaceHomeSession = currentSpaceIsTemporary && !sessionAlive;

  useEffect(() => {
    if (pendingDetachedEntrySecret) {
      actions.setEntrySecret(pendingDetachedEntrySecret);
    }
  }, [pendingDetachedEntrySecret]);

  if (!pendingDetachedEntrySecret) {
    return null;
  }

  const disabledReason = verificationPending
    ? "当前空间已有密码，请先完成空间校验后再保存游离密码。"
    : !ruleProfileConfirmed
      ? "请先在规则管理页初始化当前空间规则链。"
      : needsSpaceHomeSession
        ? "请先在空间主页设置空间主密码，再保存游离密码。"
        : !createEntryAllowed
          ? "当前空间状态不允许创建正式密码。"
          : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsSpaceHomeSession) {
      return;
    }
    const saved = await handleCreatePassword(values);
    if (saved) {
      actions.resetForm();
      clearDetachedPasswordAfterSave();
    }
  }

  return (
    <Card aria-label="待迁入派生密钥">
      <SectionHeader
        actions={
          <ActionGroup variant="entry">
            <Button
              disabled={Boolean(disabledReason)}
              onClick={() =>
                setDetachedMigrationFormVisible(!detachedMigrationFormVisible)
              }
            >
              {detachedMigrationFormVisible ? "收起保存表单" : "保存为正式密码"}
            </Button>
            <Button onClick={handleCancelDetachedPasswordMigration}>
              取消迁入
            </Button>
          </ActionGroup>
        }
        description="派生密钥已作为关键密钥草稿带入。保存时会按当前空间已初始化规则链正式生成密码；空间外预览结果不会写入正式条目。"
        title="待迁入派生密钥"
      />
      <p className="login-note">
        已带入派生密钥草稿。你可以直接沿用，也可以在保存前修改关键密钥。
      </p>
      {disabledReason ? <p className="login-note">{disabledReason}</p> : null}
      {detachedMigrationFormVisible && !disabledReason ? (
        <form
          className="form-stack"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="field-grid">
            {!sessionAlive && !needsSpaceHomeSession ? (
              <TextField
                autoComplete="current-password"
                label="空间主密码"
                onChange={(event) =>
                  actions.setMasterPassword(event.target.value)
                }
                placeholder="保存时用于建立当前空间会话"
                type="password"
                value={values.masterPassword}
              />
            ) : null}
            <TextField
              label="平台"
              onChange={(event) => actions.setPlatform(event.target.value)}
              value={values.platform}
            />
            <SelectField
              label="所属密码组，可选"
              onChange={(event) => {
                const groupId = event.target.value;
                const group = passwordGroups.find(
                  (item) => item.id === groupId
                );
                actions.setGroupId(groupId);
                if (group && !values.platform.trim()) {
                  actions.setPlatform(group.name);
                }
              }}
              value={values.groupId}
            >
              <option value="">不归属密码组</option>
              {passwordGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="普通备注，可选"
              onChange={(event) => actions.setDescription(event.target.value)}
              placeholder="不要填写关键密钥或完整生成规则"
              value={values.description}
            />
            <TextField
              autoComplete="off"
              label="关键密钥"
              onChange={(event) => actions.setEntrySecret(event.target.value)}
              placeholder="已沿用派生密钥；系统不会保存"
              value={values.entrySecret}
            />
            <TextField
              autoComplete="off"
              label="关键密钥记忆提示，可选"
              onChange={(event) => actions.setMemoryHint(event.target.value)}
              placeholder="加密保存；不要填写关键密钥本身"
              value={values.memoryHint}
            />
          </div>
          <Button
            disabled={!createEntryAllowed}
            loading={creatingPassword}
            loadingLabel="生成中..."
            type="submit"
            variant="primary"
          >
            保存为正式密码
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
