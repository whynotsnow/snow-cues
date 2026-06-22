import { StorageDataCompareTool } from "../components/StorageDataCompareTool";
import type { AppController } from "../useAppController";
import { DetachedPasswordPage } from "./DetachedPasswordPage";

type SystemToolsPageProps = {
  controller: AppController;
};

export function SystemToolsPage({ controller }: SystemToolsPageProps) {
  return (
    <section className="rules-section" aria-label="系统工具页面">
      <DetachedPasswordPage controller={controller} />
      <StorageDataCompareTool
        controller={controller}
        conflictMode={controller.storageDataConflictDetected}
      />
    </section>
  );
}
