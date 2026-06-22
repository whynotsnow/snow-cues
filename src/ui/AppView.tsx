import { useCallback, useEffect, useRef } from "react";
import { MessageRow } from "./components/MessageRow";
import { DetachedPasswordPage } from "./pages/DetachedPasswordPage";
import { SpaceIndexPanel } from "./components/SpaceIndexPanel";
import { StorageDataWorkspaceCard } from "./components/StorageDataWorkspaceCard";
import { SystemNoticeHost } from "./components/SystemNoticeHost";
import { TestDataTools } from "./components/TestDataTools";
import { Topbar } from "./components/Topbar";
import { WorkspaceView } from "./components/WorkspaceView";
import { GuidancePanel } from "./components/GuidancePanel";
import type { AppPage } from "./appTypes";
import { getUserGuidance, type GuidanceAction } from "./guidance";
import type { AppController } from "./useAppController";

type AppViewProps = {
  controller: AppController;
};

export function AppView({ controller }: AppViewProps) {
  const { activePage, currentSpaceId, outsideSpace, setActivePage } =
    controller;
  const guidance = getUserGuidance(controller);
  const showDevTools = import.meta.env.DEV;
  const initialHashApplied = useRef(false);
  const scrollResetKey = `${outsideSpace ? "outside" : currentSpaceId}:${activePage}`;

  const syncPageFromHash = useCallback(() => {
    const routePage = getPageFromHash();
    if (!routePage) {
      return;
    }
    const nextPage = getAllowedPageForScope(routePage, outsideSpace);
    if (nextPage !== routePage) {
      window.history.replaceState(null, "", getHashForPage(nextPage));
    }
    setActivePage((currentPage) =>
      currentPage === nextPage ? currentPage : nextPage
    );
  }, [outsideSpace, setActivePage]);

  useEffect(() => {
    if (!initialHashApplied.current) {
      initialHashApplied.current = true;
      syncPageFromHash();
    }

    window.addEventListener("hashchange", syncPageFromHash);
    return () => window.removeEventListener("hashchange", syncPageFromHash);
  }, [syncPageFromHash]);

  useEffect(() => {
    if (outsideSpace && activePage !== "space" && activePage !== "detached") {
      setActivePage("space");
      return;
    }
    if (!outsideSpace && activePage === "detached") {
      setActivePage("space");
      return;
    }
    const expectedHash = getHashForPage(activePage);
    if (window.location.hash !== expectedHash) {
      window.history.replaceState(null, "", expectedHash);
    }
  }, [activePage, outsideSpace, setActivePage]);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent.includes("jsdom")
    ) {
      return;
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
    });
  }, [scrollResetKey]);

  function navigateToPage(page: AppPage) {
    if (outsideSpace && page !== "space" && page !== "detached") {
      return;
    }
    setActivePage(page);
    const nextHash = getHashForPage(page);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function handleGuidanceAction(action: GuidanceAction) {
    if (action.type === "navigate") {
      navigateToPage(action.targetPage);
      return;
    }
    if (action.type === "open-create-space") {
      navigateToPage("space");
      controller.setOutsideShowCreateSpaceOptions(true);
      return;
    }
    navigateToPage("passwords");
    controller.handleCreateEntryClick();
  }

  return (
    <main className="app-shell">
      <SystemNoticeHost controller={controller} />
      <div className="app-workbench">
        <Topbar controller={controller} navigateToPage={navigateToPage} />
        <section className="main-column" aria-label="主要内容">
          <MessageRow controller={controller} />
          <StorageDataWorkspaceCard controller={controller} />
          {outsideSpace && activePage === "detached" ? (
            <DetachedPasswordPage controller={controller} />
          ) : outsideSpace ? (
            <SpaceIndexPanel controller={controller} />
          ) : (
            <WorkspaceView
              controller={controller}
              navigateToPage={navigateToPage}
            />
          )}
          {showDevTools ? <TestDataTools controller={controller} /> : null}
        </section>
        <aside className="guidance-column">
          <GuidancePanel guidance={guidance} onAction={handleGuidanceAction} />
        </aside>
      </div>
    </main>
  );
}

const pageRoutes: Record<AppPage, string> = {
  space: "#/space",
  rules: "#/rules",
  groups: "#/groups",
  passwords: "#/passwords",
  detached: "#/detached"
};

function getAllowedPageForScope(page: AppPage, outsideSpace: boolean): AppPage {
  if (outsideSpace) {
    return page === "detached" ? "detached" : "space";
  }
  return page === "detached" ? "space" : page;
}

function getHashForPage(page: AppPage) {
  return pageRoutes[page];
}

function getPageFromHash(): AppPage | null {
  const match = Object.entries(pageRoutes).find(
    ([, hash]) => hash === window.location.hash
  );
  return match ? (match[0] as AppPage) : null;
}
