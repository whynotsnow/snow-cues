import { useEffect, useMemo, useState } from "react";
import {
  adaptPasswordOutput,
  DEFAULT_PASSWORD_OUTPUT_POLICY,
  PASSWORD_OUTPUT_PRESETS,
  type PasswordOutputPolicy,
  type PasswordOutputPresetId
} from "../../crypto-engine/output-policy";
import type { PasswordGroup } from "../../storage-data";
import {
  ActionGroup,
  Button,
  CopyableSecret,
  SelectField
} from "../design-system";
import { PasswordOutputPolicyFields } from "./PasswordOutputPolicyFields";

type PasswordOutputAdapterProps = {
  corePassword: string;
  group?: PasswordGroup;
  groupManagementAllowed: boolean;
  onSaveGroupPolicy: (
    groupId: string,
    policy: PasswordOutputPolicy
  ) => Promise<void>;
};

export function PasswordOutputAdapter({
  corePassword,
  group,
  groupManagementAllowed,
  onSaveGroupPolicy
}: PasswordOutputAdapterProps) {
  const defaultPolicy = useMemo(
    () => group?.outputPolicy ?? DEFAULT_PASSWORD_OUTPUT_POLICY,
    [group?.outputPolicy]
  );
  const [policy, setPolicy] = useState<PasswordOutputPolicy>(defaultPolicy);
  const [presetId, setPresetId] = useState<PasswordOutputPresetId | "custom">(
    getPresetIdForPolicy(defaultPolicy)
  );
  const [adaptedPassword, setAdaptedPassword] = useState("");
  const [adapterError, setAdapterError] = useState("");
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPolicy(defaultPolicy);
    setPresetId(getPresetIdForPolicy(defaultPolicy));
    setEditingPolicy(false);
  }, [defaultPolicy, group?.id, corePassword]);

  useEffect(() => {
    let cancelled = false;
    setAdapterError("");
    void adaptPasswordOutput(corePassword, policy)
      .then((password) => {
        if (!cancelled) {
          setAdaptedPassword(password);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAdaptedPassword("");
          setAdapterError(
            error instanceof Error ? error.message : "密码输出适配失败。"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [corePassword, policy]);

  async function saveGroupPolicy() {
    if (!group) {
      return;
    }
    setSaving(true);
    try {
      await onSaveGroupPolicy(group.id, policy);
      setEditingPolicy(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="output-adapter-panel">
      <div className="output-adapter-header">
        <div>
          <strong>密码输出适配</strong>
          <span>
            {group
              ? `使用“${group.name}”组策略，已应用到适配密码。`
              : "未归属密码组，使用临时策略生成适配密码。"}
          </span>
        </div>
      </div>
      <CopyableSecret
        className="adapted-password-box"
        disabled={!adaptedPassword}
        label="适配密码"
        value={adaptedPassword || "无法生成适配密码"}
      />
      {adapterError ? <p className="field-note">{adapterError}</p> : null}
      <ActionGroup variant="entry">
        <Button onClick={() => setEditingPolicy((value) => !value)}>
          {editingPolicy ? "收起策略编辑" : "调整输出策略"}
        </Button>
      </ActionGroup>
      {editingPolicy ? (
        <>
          <div className="field-grid">
            <SelectField
              label="常见策略预设"
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setPresetId("custom");
                  return;
                }
                const preset = PASSWORD_OUTPUT_PRESETS.find(
                  (item) => item.id === event.target.value
                );
                if (preset) {
                  setPresetId(preset.id);
                  setPolicy(preset.policy);
                }
              }}
              value={presetId}
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
            disabled={presetId !== "custom"}
            onChange={(nextPolicy) => {
              setPresetId("custom");
              setPolicy(nextPolicy);
            }}
            policy={policy}
          />
          {presetId !== "custom" ? (
            <p className="field-note">
              内置常见策略不可直接改动；切换到“自定义当前策略”后可基于当前参数调整。
            </p>
          ) : null}
          {group ? (
            <ActionGroup variant="entry">
              <Button
                disabled={!groupManagementAllowed}
                loading={saving}
                loadingLabel="保存中..."
                onClick={() => void saveGroupPolicy()}
              >
                保存为组输出策略
              </Button>
            </ActionGroup>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function getPresetIdForPolicy(
  policy: PasswordOutputPolicy
): PasswordOutputPresetId | "custom" {
  return (
    PASSWORD_OUTPUT_PRESETS.find((preset) =>
      policiesEqual(preset.policy, policy)
    )?.id ?? "custom"
  );
}

function policiesEqual(
  left: PasswordOutputPolicy,
  right: PasswordOutputPolicy
) {
  return JSON.stringify(left) === JSON.stringify(right);
}
