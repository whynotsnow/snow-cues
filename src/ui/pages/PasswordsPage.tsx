import type { AppController } from "../useAppController";
import { CreatePasswordForm } from "../components/CreatePasswordForm";
import { DetachedPasswordMigrationCard } from "../components/DetachedPasswordMigrationCard";
import { EntriesSection } from "../components/EntriesSection";

type PasswordsPageProps = {
  controller: AppController;
};

export function PasswordsPage({ controller }: PasswordsPageProps) {
  const {
    ruleProfileConfirmed,
    verificationPending,
    createEntryAllowed,
    currentSpaceStatus,
    showCreateForm,
    handleCreateEntryClick
  } = controller;
  const spaceAllowsCreate = currentSpaceStatus === "active";
  const createDisabled = verificationPending || !spaceAllowsCreate;
  const createLabel = !spaceAllowsCreate
    ? "新建不可用"
    : verificationPending
      ? "校验后可新建"
      : !ruleProfileConfirmed
        ? "先初始化规则链"
        : !createEntryAllowed
          ? "新建不可用"
          : showCreateForm
            ? "收起新建"
            : "新建密码";

  return (
    <>
      <section className="section-card" aria-label="新建密码入口">
        <div className="section-header">
          <div>
            <h2>密码管理</h2>
            <p>
              查看、解密和维护当前空间中的密码条目。新建密码需要正常空间、可用会话和已初始化规则链；受限空间只保留允许的查看能力。
            </p>
          </div>
          <button
            className="primary-button"
            disabled={createDisabled}
            onClick={handleCreateEntryClick}
            type="button"
          >
            {createLabel}
          </button>
        </div>
      </section>

      <DetachedPasswordMigrationCard controller={controller} />
      {showCreateForm ? <CreatePasswordForm controller={controller} /> : null}
      <EntriesSection
        controller={controller}
        hideVerificationControls={verificationPending}
      />
    </>
  );
}
