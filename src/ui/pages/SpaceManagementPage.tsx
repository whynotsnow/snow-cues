import type { AppController } from "../useAppController";
import { EntryCard } from "../components/EntryCard";
import { EntryVerificationPanel } from "../components/EntryVerificationPanel";
import { SpaceMigrationCard } from "../components/space-management/SpaceMigrationCard";
import { SpaceOperationsCard } from "../components/space-management/SpaceOperationsCard";
import { SpaceOverviewCard } from "../components/space-management/SpaceOverviewCard";
import { SpaceSessionSetupCard } from "../components/space-management/SpaceSessionSetupCard";

type SpaceManagementPageProps = {
  controller: AppController;
};

export function SpaceManagementPage({ controller }: SpaceManagementPageProps) {
  const {
    entries,
    loginVerificationEntryId,
    handleSelectLoginVerificationEntry,
    migrationBatches,
    sessionAlive
  } = controller;
  const totalCount = migrationBatches.reduce((sum, batch) => sum + batch.totalCount, 0);
  const doneCount = migrationBatches.reduce((sum, batch) => sum + batch.migratedCount, 0);
  const pendingCount = Math.max(totalCount - doneCount, 0);
  const verificationEntry = loginVerificationEntryId
    ? entries.find((entry) => entry.id === loginVerificationEntryId)
    : null;

  return (
    <section className="space-page" aria-label="空间主页">
      <SpaceOverviewCard controller={controller} />

      {verificationEntry ? (
        <section className="section-card" aria-label="空间校验">
          <EntryVerificationPanel
            title="空间校验"
            description="当前空间已有密码。默认使用最近更新的条目校验；如果你忘记了这条关键密钥，可以改选另一条已知关键密钥的密码。"
            entries={entries}
            selectedEntryId={loginVerificationEntryId ?? ""}
            selectLabel="用于校验的密码条目"
            onSelectEntry={handleSelectLoginVerificationEntry}
          >
            <EntryCard controller={controller} entry={verificationEntry} autoOpenVerification />
          </EntryVerificationPanel>
        </section>
      ) : null}

      {!verificationEntry && !sessionAlive ? <SpaceSessionSetupCard controller={controller} /> : null}

      <SpaceMigrationCard
        controller={controller}
        doneCount={doneCount}
        pendingCount={pendingCount}
        totalCount={totalCount}
      />

      <SpaceOperationsCard controller={controller} />
    </section>
  );
}
