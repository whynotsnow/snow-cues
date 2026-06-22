import type { AppController } from "../useAppController";
import { Button, EmptyState, SectionHeader } from "../design-system";
import { EntryCard } from "./EntryCard";

type EntriesSectionProps = {
  controller: AppController;
  hideVerificationControls?: boolean;
};

export function EntriesSection({
  controller,
  hideVerificationControls = false
}: EntriesSectionProps) {
  const { entries, refreshEntries } = controller;

  return (
    <section className="entries-section" aria-label="已存储的加密密码">
      <SectionHeader
        actions={<Button onClick={refreshEntries}>刷新</Button>}
        description="列表只展示平台和普通备注。点击解密后再输入关键密钥；解密失败会提示，不会修改存储数据。"
        title="已存储密码"
      />
      <div className="entries-grid">
        {entries.length === 0 ? (
          <EmptyState>还没有保存任何加密条目。</EmptyState>
        ) : (
          entries.map((entry) => (
            <EntryCard
              controller={controller}
              entry={entry}
              hideVerificationControls={hideVerificationControls}
              key={entry.id}
            />
          ))
        )}
      </div>
    </section>
  );
}
