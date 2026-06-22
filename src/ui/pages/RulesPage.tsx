import { useState } from "react";
import { availableRules } from "../../rule-registry/rules";
import {
  ActionGroup,
  Button,
  Card,
  SectionHeader,
  TextareaField,
  TextField
} from "../design-system";
import type { AppController } from "../useAppController";

type RulesPageProps = {
  controller: AppController;
};

const DEV_SAMPLE_RULE_MANIFESTS = [
  {
    id: "imported-office",
    name: "办公规则",
    algorithm: "hmac-sha256",
    namespace: "office"
  },
  {
    id: "imported-finance",
    name: "财务规则",
    algorithm: "pbkdf2-sha256",
    namespace: "finance",
    iterations: 260_000
  }
] as const;

export function RulesPage({ controller }: RulesPageProps) {
  const {
    draftRuleIds,
    ruleProfileConfirmed,
    effectiveRules,
    importedRules,
    ruleImportText,
    setRuleImportText,
    availableRuleOptions,
    draftRuleProfileAllowed,
    confirmRuleProfileAllowed,
    sessionAlive,
    currentSpaceIsTemporary,
    confirmingProfile,
    handleDraftRuleToggle,
    handleConfirmRuleProfile,
    handleImportedRuleNameChange,
    handleImportedRuleToggle,
    handleImportedRuleDelete,
    handleImportRule
  } = controller;
  const [masterPassword, setMasterPassword] = useState("");
  const needsSpaceHomeSession = currentSpaceIsTemporary && !sessionAlive;
  const showDevRuleSamples = import.meta.env.DEV;

  async function confirmRuleProfile() {
    if (needsSpaceHomeSession) {
      return;
    }
    const confirmed = await handleConfirmRuleProfile(masterPassword);
    if (confirmed) {
      setMasterPassword("");
    }
  }

  return (
    <section className="rules-section" aria-label="规则管理">
      <SectionHeader
        description="规则是系统级配置。JSON 导入只会生成受控的声明式规则定义，运行时仍映射到内置算法模板。"
        title="规则管理"
      />
      <section className="rule-init-panel" aria-label="规则链初始化">
        <SectionHeader
          actions={
            <Button
              disabled={
                ruleProfileConfirmed ||
                !confirmRuleProfileAllowed ||
                needsSpaceHomeSession
              }
              loading={confirmingProfile}
              loadingLabel="初始化中..."
              onClick={() => void confirmRuleProfile()}
            >
              {ruleProfileConfirmed ? "已初始化" : "确认初始化"}
            </Button>
          }
          description="规则链决定密码生成路径。由于单条密码不会保存规则信息，初始化后继续变更规则会让旧密码难以追溯。"
          title="规则链初始化"
        />
        {needsSpaceHomeSession ? (
          <p className="field-note">
            请先在空间主页设置空间主密码，再初始化规则链。
          </p>
        ) : null}
        {!sessionAlive && !ruleProfileConfirmed && !needsSpaceHomeSession ? (
          <TextField
            autoComplete="current-password"
            className="inline-secret-field"
            label="空间主密码"
            onChange={(event) => setMasterPassword(event.target.value)}
            placeholder="确认初始化时用于建立当前空间会话"
            type="password"
            value={masterPassword}
          />
        ) : null}
        <div className="rule-choice-list">
          {availableRuleOptions.map((rule) => (
            <label className="rule-choice" key={rule.id}>
              <input
                checked={draftRuleIds.includes(rule.id)}
                disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
                onChange={() => handleDraftRuleToggle(rule.id)}
                type="checkbox"
              />
              <span>
                <strong>{rule.label}</strong>
                <small>
                  {rule.id} · {rule.origin}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="effective-rule">
          <span>
            {ruleProfileConfirmed ? "已冻结规则链" : "待初始化规则链"}
          </span>
          <strong>
            {effectiveRules.length > 0
              ? effectiveRules.map((rule) => rule.label).join(" → ")
              : "未选择规则"}
          </strong>
          <small>
            规则会按从左到右的顺序执行，上一条规则的输出会进入下一条规则；最终结果再按编码策略生成密码。
          </small>
        </div>
      </section>
      <div className="rule-grid">
        {availableRules.map((rule) => (
          <Card as="article" className="rule-card" key={rule.id} tone="subtle">
            <div className="rule-card-header">
              <strong>{rule.label}</strong>
              <span>{rule.origin}</span>
            </div>
            <p>{rule.description}</p>
            <code>{rule.id}</code>
          </Card>
        ))}
        {importedRules.map((item) => (
          <Card
            as="article"
            className="rule-card"
            key={item.manifest.id}
            tone="subtle"
          >
            <div className="rule-card-header">
              <strong>{item.definition.label}</strong>
              <span>{item.enabled ? "已生效" : "未生效"}</span>
            </div>
            <TextField
              defaultValue={item.manifest.name}
              disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
              label="规则名称"
              onBlur={(event) =>
                handleImportedRuleNameChange(
                  item.manifest.id,
                  event.target.value
                )
              }
            />
            <p>{item.definition.description}</p>
            <code>{item.manifest.id}</code>
            <ActionGroup variant="entry">
              <Button
                disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
                onClick={() => handleImportedRuleToggle(item.manifest.id)}
              >
                {item.enabled ? "停用" : "启用"}
              </Button>
              <Button
                disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
                onClick={() => handleImportedRuleDelete(item.manifest.id)}
              >
                删除规则
              </Button>
            </ActionGroup>
          </Card>
        ))}
      </div>
      <form className="rule-import" onSubmit={handleImportRule}>
        <TextareaField
          disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
          hint="支持单个声明式规则 JSON 对象，或由多个规则对象组成的 JSON 数组。规则 ID 需使用 imported- 前缀。"
          label="导入声明式规则或规则数组"
          onChange={(event) => setRuleImportText(event.target.value)}
          placeholder="粘贴声明式规则 JSON"
          value={ruleImportText}
        />
        <Button
          disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
          type="submit"
        >
          导入规则
        </Button>
      </form>
      {showDevRuleSamples ? (
        <section className="sample-rules" aria-label="开发导入规则样例">
          <SectionHeader
            description="仅在开发环境显示，用于快速填入声明式规则 JSON；正式导入功能仍以手动粘贴 JSON 为准。"
            title="开发导入规则样例"
          />
          <div className="sample-rule-grid">
            {DEV_SAMPLE_RULE_MANIFESTS.map((manifest) => (
              <Card
                as="article"
                className="sample-rule-card"
                key={manifest.id}
                tone="subtle"
              >
                <strong>{manifest.name}</strong>
                <code>{JSON.stringify(manifest)}</code>
                <Button
                  disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
                  onClick={() =>
                    setRuleImportText(JSON.stringify(manifest, null, 2))
                  }
                >
                  填入导入框
                </Button>
              </Card>
            ))}
          </div>
          <ActionGroup variant="tool">
            <Button
              disabled={ruleProfileConfirmed || !draftRuleProfileAllowed}
              onClick={() =>
                setRuleImportText(
                  JSON.stringify(DEV_SAMPLE_RULE_MANIFESTS, null, 2)
                )
              }
            >
              填入批量导入样例
            </Button>
          </ActionGroup>
        </section>
      ) : null}
    </section>
  );
}
