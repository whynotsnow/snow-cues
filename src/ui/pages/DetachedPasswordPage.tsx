import type { FormEvent } from "react";
import type { EncodingMode } from "../../crypto-engine/encoding";
import { PASSWORD_OUTPUT_PRESETS, type PasswordOutputPolicy } from "../../crypto-engine/output-policy";
import { ActionGroup, Button, Card, CheckboxField, NumberField, SectionHeader, SelectField, TextField } from "../design-system";
import type { AppController } from "../useAppController";
import { PasswordOutputPolicyFields } from "../components/PasswordOutputPolicyFields";

type DetachedPasswordPageProps = {
  controller: AppController;
};

export function DetachedPasswordPage({ controller }: DetachedPasswordPageProps) {
  const {
    detachedDerivationKey,
    setDetachedDerivationKey,
    detachedEncodingMode,
    setDetachedEncodingMode,
    detachedCustomCharset,
    setDetachedCustomCharset,
    detachedMaxLength,
    setDetachedMaxLength,
    detachedOutputPresetId,
    setDetachedOutputPresetId,
    detachedOutputPolicy,
    setDetachedOutputPolicy,
    detachedApplyOutputPolicy,
    setDetachedApplyOutputPolicy,
    detachedPasswordPreview,
    detachedPasswordVisible,
    setDetachedPasswordVisible,
    detachedGenerating,
    detachedCopyStatus,
    handleGenerateDetachedPassword,
    handleCopyDetachedPassword,
    handleClearDetachedPassword,
    handleStartDetachedPasswordMigration
  } = controller;

  async function generateDetachedPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleGenerateDetachedPassword();
  }

  return (
    <section className="rules-section" aria-label="游离密码页面">
      <Card aria-label="游离密码">
        <SectionHeader
          description="空间外临时预览，不进入迁移队列，不保存派生密钥或生成历史。迁移到空间时只带入派生密钥草稿，并按目标空间规则链正式生成。"
          title="游离密码"
        />
        <form className="form-stack" onSubmit={(event) => void generateDetachedPassword(event)}>
          <div className="field-grid">
            <TextField
              autoComplete="off"
              label="派生密钥"
              onChange={(event) => setDetachedDerivationKey(event.target.value)}
              placeholder="只用于本次生成，系统不会保存"
              value={detachedDerivationKey}
            />
            <SelectField label="核心编码" onChange={(event) => setDetachedEncodingMode(event.target.value as EncodingMode)} value={detachedEncodingMode}>
              <option value="base62">Base62</option>
              <option value="base64">Base64</option>
              <option value="custom">自定义字符集</option>
            </SelectField>
            <NumberField
              label="核心材料长度"
              max={64}
              min={8}
              onChange={(event) => setDetachedMaxLength(Number(event.target.value))}
              value={detachedMaxLength}
            />
            <SelectField
              label="输出策略预设"
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setDetachedOutputPresetId("custom");
                  return;
                }
                const preset = PASSWORD_OUTPUT_PRESETS.find((item) => item.id === event.target.value);
                if (preset) {
                  setDetachedOutputPresetId(preset.id);
                  setDetachedOutputPolicy(preset.policy);
                }
              }}
              value={detachedOutputPresetId}
            >
              <option value="custom">自定义当前策略</option>
              {PASSWORD_OUTPUT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </SelectField>
          </div>
          {detachedEncodingMode === "custom" ? (
            <TextField
              autoComplete="off"
              label="自定义字符集"
              onChange={(event) => setDetachedCustomCharset(event.target.value)}
              value={detachedCustomCharset}
            />
          ) : null}
          <PasswordOutputPolicyFields
            disabled={detachedOutputPresetId !== "custom"}
            onChange={(policy: PasswordOutputPolicy) => {
              setDetachedOutputPresetId("custom");
              setDetachedOutputPolicy(policy);
            }}
            policy={detachedOutputPolicy}
          />
          <CheckboxField
            checked={detachedApplyOutputPolicy}
            label="预览时应用输出策略"
            onChange={(event) => setDetachedApplyOutputPolicy(event.target.checked)}
          />
          {detachedOutputPresetId !== "custom" ? (
            <p className="field-note">输出策略只影响空间外预览；迁移到空间后会沿用派生密钥，并由目标空间稳定规则链正式生成密码。</p>
          ) : null}
          <ActionGroup variant="tool">
            <Button disabled={detachedGenerating} loading={detachedGenerating} loadingLabel="生成中..." type="submit" variant="primary">
              生成游离密码
            </Button>
            <Button onClick={handleClearDetachedPassword}>
              不迁移并清空
            </Button>
          </ActionGroup>
        </form>
        {detachedPasswordPreview ? (
          <div className="detached-result">
            <span>{detachedApplyOutputPolicy ? "策略处理预览" : "核心密码预览"}</span>
            <code>{detachedPasswordVisible ? detachedPasswordPreview : "••••••••••••••••••••••••"}</code>
            <ActionGroup variant="entry">
              <Button onClick={() => setDetachedPasswordVisible(!detachedPasswordVisible)}>
                {detachedPasswordVisible ? "隐藏" : "显示"}
              </Button>
              <Button onClick={() => void handleCopyDetachedPassword()}>
                复制
              </Button>
              <Button onClick={handleStartDetachedPasswordMigration} variant="primary">
                迁移到空间
              </Button>
            </ActionGroup>
            {detachedCopyStatus ? <p className="login-note">{detachedCopyStatus}</p> : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
