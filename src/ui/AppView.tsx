import { useCallback, useEffect, useRef } from "react";
import { MessageRow } from "./components/MessageRow";
import { Notice } from "./notifications/Notice";
import { SpaceIndexPanel } from "./components/SpaceIndexPanel";
import { StorageDataWorkspaceCard } from "./components/StorageDataWorkspaceCard";
import { SystemNoticeHost } from "./components/SystemNoticeHost";
import { TestDataTools } from "./components/TestDataTools";
import { NavRail } from "./components/NavRail";
import { WorkspaceView } from "./components/WorkspaceView";
import { GuidanceDrawer } from "./components/GuidanceDrawer";
import { SystemToolsPage } from "./pages/SystemToolsPage";
import type { AppPage } from "./appTypes";
import { getUserGuidance, type GuidanceAction } from "./guidance";
import type { AppController } from "./useAppController";

type AppViewProps = {
  controller: AppController;
};

export function AppView({ controller }: AppViewProps) {
  const { activePage, currentSpaceId, outsideSpace, setActivePage } =
    controller;
  const guidance = getUserGuidance(controller, { includeDocumentation: true });
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
    if (outsideSpace && activePage !== "space" && activePage !== "tools") {
      setActivePage("space");
      return;
    }
    if (!outsideSpace && activePage === "tools") {
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
    if (outsideSpace && page !== "space" && page !== "tools") {
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
    if (action.type === "external-link") {
      window.open(action.href, "_blank", "noreferrer");
      return;
    }
    navigateToPage("passwords");
    controller.handleCreateEntryClick();
  }

  return (
    <main className="app-shell">
      <SystemNoticeHost controller={controller} />
      <div className="app-workbench">
        <NavRail controller={controller} navigateToPage={navigateToPage} />

        <div className="content-column">
          {/* Inside space: compact storage data bar across full width */}
          {!outsideSpace && activePage !== "tools" ? (
            <StorageDataWorkspaceCard controller={controller} />
          ) : null}

          <div className="content-scroll">
            <div className="content-area">
              <section className="main-column" aria-label="主要内容">
                <MessageRow controller={controller} />
                {!controller.browserCapabilities.coreCryptoAvailable ? (
                  <Notice
                    notice={{
                      scope: "page",
                      tone: "error",
                      title: "当前环境不支持安全加密",
                      body: controller.browserCapabilities
                        .coreCryptoUnavailableMessage
                    }}
                  />
                ) : null}

                {/* Outside space: full storage data card inside content flow */}
                {outsideSpace && activePage !== "tools" ? (
                  <StorageDataWorkspaceCard controller={controller} />
                ) : null}

                {outsideSpace && activePage === "tools" ? (
                  <SystemToolsPage controller={controller} />
                ) : outsideSpace ? (
                  <SpaceIndexPanel controller={controller} />
                ) : (
                  <WorkspaceView
                    controller={controller}
                    navigateToPage={navigateToPage}
                  />
                )}
                {showDevTools ? (
                  <TestDataTools controller={controller} />
                ) : null}
              </section>

              <GuidanceDrawer
                guidance={guidance}
                onAction={handleGuidanceAction}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const pageRoutes: Record<AppPage, string> = {
  space: "#/space",
  rules: "#/rules",
  groups: "#/groups",
  passwords: "#/passwords",
  tools: "#/tools"
};

function getAllowedPageForScope(page: AppPage, outsideSpace: boolean): AppPage {
  if (outsideSpace) {
    return page === "tools" ? "tools" : "space";
  }
  return page === "tools" ? "space" : page;
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
