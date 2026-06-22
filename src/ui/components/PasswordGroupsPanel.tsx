import {
  normalizePasswordOutputPolicy,
  PASSWORD_OUTPUT_PRESETS,
  type PasswordOutputPolicy
} from "../../crypto-engine/output-policy";
import { useState } from "react";
import {
  ActionGroup,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  SectionHeader,
  SelectField,
  TextField
} from "../design-system";
import type { PasswordGroupDraft } from "../hooks/usePasswordGroupController";
import type { AppController } from "../useAppController";
import { PasswordOutputPolicyFields } from "./PasswordOutputPolicyFields";

type PasswordGroupsPanelProps = {
  controller: AppController;
};

export function PasswordGroupsPanel({ controller }: PasswordGroupsPanelProps) {
  const {
    passwordGroups,
    groupDraft,
    setGroupDraft,
    editingGroupId,
    editingGroupDraft,
    setEditingGroupDraft,
    groupSavingId,
    creatingGroup,
    groupManagementAllowed,
    sessionAlive,
    currentSpaceIsTemporary,
    handleCreatePasswordGroup,
    handleStartEditPasswordGroup,
    handleCancelEditPasswordGroup,
    handleSavePasswordGroup,
    handleDeletePasswordGroup
  } = controller;
  const [masterPassword, setMasterPassword] = useState("");
  const needsSpaceHomeSession = currentSpaceIsTemporary && !sessionAlive;

  async function createPasswordGroup() {
    if (needsSpaceHomeSession) {
      return;
    }
    await handleCreatePasswordGroup(masterPassword);
    setMasterPassword("");
  }

  return (
    <Card aria-label="密码组输出适配">
      <SectionHeader
        description="密码组用于管理同一平台或系统的多个账号。组名、平台和备注是隐私元数据，请不要填写账号、关键密钥或敏感规则。"
        title="密码组输出适配"
      />
      <div className="group-editor">
        <GroupDraftFields
          disabled={
            !groupManagementAllowed || creatingGroup || needsSpaceHomeSession
          }
          draft={groupDraft}
          onChange={setGroupDraft}
        />
        {needsSpaceHomeSession ? (
          <p className="field-note">
            请先在空间主页设置空间主密码，再创建密码组。
          </p>
        ) : null}
        {!sessionAlive && !needsSpaceHomeSession ? (
          <TextField
            autoComplete="current-password"
            className="inline-secret-field"
            label="空间主密码"
            onChange={(event) => setMasterPassword(event.target.value)}
            placeholder="创建密码组时用于建立当前空间会话"
            type="password"
            value={masterPassword}
          />
        ) : null}
        <Button
          disabled={!groupManagementAllowed || needsSpaceHomeSession}
          loading={creatingGroup}
          loadingLabel="创建中..."
          onClick={() => void createPasswordGroup()}
          variant="primary"
        >
          创建密码组
        </Button>
      </div>
      <div className="password-group-list">
        {passwordGroups.length === 0 ? (
          <EmptyState>
            还没有密码组。可以先创建常用平台或系统的分组，再把多个账号条目归到同一组。
          </EmptyState>
        ) : (
          passwordGroups.map((group) => {
            const isEditing = editingGroupId === group.id && editingGroupDraft;
            return (
              <Card
                as="article"
                className="password-group-card"
                key={group.id}
                tone="subtle"
              >
                {isEditing ? (
                  <>
                    <GroupDraftFields
                      disabled={
                        !groupManagementAllowed || groupSavingId === group.id
                      }
                      draft={editingGroupDraft}
                      onChange={setEditingGroupDraft}
                    />
                    <ActionGroup variant="entry">
                      <Button
                        disabled={!groupManagementAllowed}
                        loading={groupSavingId === group.id}
                        loadingLabel="保存中..."
                        onClick={() => void handleSavePasswordGroup(group.id)}
                      >
                        保存密码组
                      </Button>
                      <Button
                        disabled={groupSavingId === group.id}
                        onClick={handleCancelEditPasswordGroup}
                      >
                        取消编辑
                      </Button>
                    </ActionGroup>
                  </>
                ) : (
                  <>
                    <DescriptionList
                      className="group-summary"
                      items={[
                        { label: "组名", value: group.name },
                        { label: "说明", value: group.description ?? "未填写" },
                        {
                          label: "输出策略",
                          value: formatOutputPolicySummary(group.outputPolicy)
                        }
                      ]}
                    />
                    <ActionGroup variant="entry">
                      <Button
                        disabled={!groupManagementAllowed}
                        onClick={() => handleStartEditPasswordGroup(group)}
                      >
                        编辑密码组
                      </Button>
                      <Button
                        disabled={!groupManagementAllowed}
                        onClick={() => void handleDeletePasswordGroup(group.id)}
                      >
                        删除空组
                      </Button>
                    </ActionGroup>
                  </>
                )}
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
}

function formatOutputPolicySummary(policy: PasswordOutputPolicy) {
  const normalizedPolicy = normalizePasswordOutputPolicy(policy);
  const preset = PASSWORD_OUTPUT_PRESETS.find((item) =>
    policiesEqual(item.policy, normalizedPolicy)
  );
  const prefix = preset ? preset.label : "自定义策略";
  return `${prefix} · ${describeOutputPolicy(normalizedPolicy)}`;
}

function policiesEqual(
  left: PasswordOutputPolicy,
  right: PasswordOutputPolicy
) {
  return (
    JSON.stringify(normalizePasswordOutputPolicy(left)) ===
    JSON.stringify(normalizePasswordOutputPolicy(right))
  );
}

function describeOutputPolicy(policy: PasswordOutputPolicy) {
  const enabledTypes = [
    policy.useUppercase ? `大写≥${policy.minUppercase}` : "",
    policy.useLowercase ? `小写≥${policy.minLowercase}` : "",
    policy.useDigits ? `数字≥${policy.minDigits}` : "",
    policy.useSymbols ? `符号≥${policy.minSymbols}` : ""
  ].filter(Boolean);
  const forbidden = policy.forbiddenChars
    ? `，禁用 ${policy.forbiddenChars}`
    : "";
  return `${policy.length} 位，${enabledTypes.join(" / ") || "未启用字符类型"}${forbidden}`;
}

type GroupDraftFieldsProps = {
  disabled: boolean;
  draft: PasswordGroupDraft;
  onChange: (draft: PasswordGroupDraft) => void;
};

function GroupDraftFields({
  disabled,
  draft,
  onChange
}: GroupDraftFieldsProps) {
  function patch(next: Partial<PasswordGroupDraft>) {
    onChange({
      ...draft,
      ...next
    });
  }

  function setPolicy(outputPolicy: PasswordOutputPolicy) {
    patch({ presetId: "custom", outputPolicy });
  }

  return (
    <>
      <div className="field-grid">
        <TextField
          disabled={disabled}
          label="密码组名称"
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="例如 代码托管或公司系统"
          value={draft.name}
        />
        <TextField
          disabled={disabled}
          label="说明，可选"
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="不要填写账号、关键密钥或敏感规则"
          value={draft.description}
        />
        <SelectField
          disabled={disabled}
          label="常见策略预设"
          onChange={(event) => {
            if (event.target.value === "custom") {
              patch({ presetId: "custom" });
              return;
            }
            const preset = PASSWORD_OUTPUT_PRESETS.find(
              (item) => item.id === event.target.value
            );
            if (preset) {
              patch({ presetId: preset.id, outputPolicy: preset.policy });
            }
          }}
          value={draft.presetId}
        >
          <option value="custom">自定义当前策略</option>
          {PASSWORD_OUTPUT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </SelectField>
      </div>
      <PasswordOutputPolicyFields
        disabled={disabled || draft.presetId !== "custom"}
        onChange={setPolicy}
        policy={draft.outputPolicy}
      />
      {draft.presetId !== "custom" ? (
        <p className="field-note">
          内置常见策略不可直接改动；切换到“自定义当前策略”后可基于当前参数调整。
        </p>
      ) : null}
    </>
  );
}
