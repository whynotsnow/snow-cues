import type { AppController } from "../useAppController";
import type { AppPage } from "../appTypes";
import { Notice } from "../notifications/Notice";
import { getPageNotice } from "../pageNotices";
import { PasswordGroupsPage } from "../pages/PasswordGroupsPage";
import { PasswordsPage } from "../pages/PasswordsPage";
import { RulesPage } from "../pages/RulesPage";
import { SpaceManagementPage } from "../pages/SpaceManagementPage";

type WorkspaceViewProps = {
  controller: AppController;
  navigateToPage: (page: AppPage) => void;
};

export function WorkspaceView({
  controller,
  navigateToPage
}: WorkspaceViewProps) {
  const { activePage } = controller;
  const pageNotice = getPageNotice(controller);
  const pageNoticeAction = pageNotice?.action;

  return (
    <section className="workspace" aria-label="已进入空间工作区">
      <section className="workspace-route" aria-label="当前页面">
        {pageNotice ? (
          <div className="page-notice-area" aria-label="页面通知">
            <Notice
              notice={pageNotice}
              onAction={
                pageNoticeAction
                  ? () => navigateToPage(pageNoticeAction.targetPage)
                  : undefined
              }
            />
          </div>
        ) : null}
        {activePage === "space" ? (
          <SpaceManagementPage controller={controller} />
        ) : activePage === "passwords" ? (
          <PasswordsPage controller={controller} />
        ) : activePage === "groups" ? (
          <PasswordGroupsPage controller={controller} />
        ) : (
          <RulesPage controller={controller} />
        )}
      </section>
    </section>
  );
}
