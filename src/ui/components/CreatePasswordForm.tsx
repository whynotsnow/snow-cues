import type { FormEvent } from "react";
import type { EncodingMode } from "../../crypto-engine/encoding";
import { Button, NumberField, SelectField, TextField } from "../design-system";
import { useCreatePasswordForm } from "../hooks/useCreatePasswordForm";
import type { AppController } from "../useAppController";

type CreatePasswordFormProps = {
  controller: AppController;
};

export function CreatePasswordForm({ controller }: CreatePasswordFormProps) {
  const {
    effectiveRules,
    creatingPassword,
    createEntryAllowed,
    sessionAlive,
    currentSpaceIsTemporary,
    passwordGroups,
    handleCreatePassword
  } = controller;
  const form = useCreatePasswordForm();
  const { values, actions } = form;
  const needsSpaceHomeSession = currentSpaceIsTemporary && !sessionAlive;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsSpaceHomeSession) {
      return;
    }
    const saved = await handleCreatePassword(values);
    if (saved) {
      actions.resetForm();
    }
  }

  return (
    <form
      className="generator-panel"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="panel-heading">
        <h2>新建密码</h2>
        <p>
          当前密码会使用已初始化的规则链。请确认你能在未来用同一组规则和同一个关键密钥重建结果。
        </p>
      </div>
      <ol className="flow-preview">
        <li>
          读取已冻结的规则链：
          {effectiveRules.map((rule) => rule.label).join(" → ")}
        </li>
        <li>输入关键密钥，按规则链顺序生成密码材料</li>
        <li>将最终材料编码为密码输出</li>
        <li>用空间会话和关键密钥派生临时 AES-GCM key</li>
        <li>仅保存加密后的密码输出；可选记忆提示会单独加密保存</li>
      </ol>
      <div className="effective-rule">
        <span>当前生效规则链</span>
        <strong>{effectiveRules.map((rule) => rule.label).join(" → ")}</strong>
        <small>
          {effectiveRules.map((rule) => rule.description).join(" ")}
        </small>
      </div>
      <div className="field-grid">
        {needsSpaceHomeSession ? (
          <p className="field-note">
            请先在空间主页设置空间主密码，再创建密码。
          </p>
        ) : null}
        {!sessionAlive && !needsSpaceHomeSession ? (
          <TextField
            autoComplete="current-password"
            label="空间主密码"
            onChange={(event) => actions.setMasterPassword(event.target.value)}
            placeholder="生成并保存时用于建立当前空间会话"
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
            const group = passwordGroups.find((item) => item.id === groupId);
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
          placeholder="系统不会保存关键密钥"
          value={values.entrySecret}
        />
        <TextField
          autoComplete="off"
          label="关键密钥记忆提示，可选"
          onChange={(event) => actions.setMemoryHint(event.target.value)}
          placeholder="加密保存；不要填写关键密钥本身"
          value={values.memoryHint}
        />
        <SelectField
          label="输出编码"
          onChange={(event) =>
            actions.setEncodingMode(event.target.value as EncodingMode)
          }
          value={values.encodingMode}
        >
          <option value="base62">Base62</option>
          <option value="base64">Base64</option>
          <option value="custom">自定义字符集</option>
        </SelectField>
        <NumberField
          label="长度"
          max={64}
          min={8}
          onChange={(event) => actions.setMaxLength(Number(event.target.value))}
          value={values.maxLength}
        />
      </div>

      {values.encodingMode === "custom" ? (
        <TextField
          autoComplete="off"
          label="自定义字符集"
          onChange={(event) => actions.setCustomCharset(event.target.value)}
          value={values.customCharset}
        />
      ) : null}

      <Button
        disabled={!createEntryAllowed || needsSpaceHomeSession}
        loading={creatingPassword}
        loadingLabel="生成中..."
        type="submit"
        variant="primary"
      >
        生成并保存
      </Button>
    </form>
  );
}
