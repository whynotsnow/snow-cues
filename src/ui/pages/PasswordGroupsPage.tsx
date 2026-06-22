import type { AppController } from "../useAppController";
import { PasswordGroupsPanel } from "../components/PasswordGroupsPanel";

type PasswordGroupsPageProps = {
  controller: AppController;
};

export function PasswordGroupsPage({ controller }: PasswordGroupsPageProps) {
  return <PasswordGroupsPanel controller={controller} />;
}
