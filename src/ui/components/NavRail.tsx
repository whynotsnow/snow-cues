import type { AppController } from "../useAppController";
import { spaceStatusLabels } from "../useAppController";
import type { AppPage } from "../appTypes";
import { ThemeToggle } from "./ThemeToggle";

type NavRailProps = {
  controller: AppController;
  navigateToPage: (page: AppPage) => void;
};

export function NavRail({ controller, navigateToPage }: NavRailProps) {
  const {
    activePage,
    currentSpaceId,
    currentSpaceStatus,
    currentSpaceIsTemporary,
    outsideSpace,
    leaveSpace
  } = controller;

  return (
    <nav className="nav-rail" aria-label="应用状态">
      <div className="nav-rail-brand">
        <p className="eyebrow">◈ Snow Cues v2.3</p>
        <p className="nav-rail-subtitle">
          以用户维护的存储数据文件夹作为唯一业务数据源。
        </p>
      </div>

      <div className="nav-rail-nav">
        {outsideSpace ? (
          <>
            <button
              className={`nav-item${activePage !== "tools" ? " active" : ""}`}
              onClick={() => navigateToPage("space")}
              type="button"
            >
              空间工作台
            </button>
            <button
              className={`nav-item${activePage === "tools" ? " active" : ""}`}
              onClick={() => navigateToPage("tools")}
              type="button"
            >
              系统工具
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-item${activePage === "space" ? " active" : ""}`}
              onClick={() => navigateToPage("space")}
              type="button"
            >
              空间主页
            </button>
            <button
              className={`nav-item${activePage === "rules" ? " active" : ""}`}
              onClick={() => navigateToPage("rules")}
              type="button"
            >
              规则管理
            </button>
            <button
              className={`nav-item${activePage === "groups" ? " active" : ""}`}
              onClick={() => navigateToPage("groups")}
              type="button"
            >
              输出适配
            </button>
            <button
              className={`nav-item${activePage === "passwords" ? " active" : ""}`}
              onClick={() => navigateToPage("passwords")}
              type="button"
            >
              密码管理
            </button>
          </>
        )}
      </div>

      <hr className="nav-rail-divider" />

      <div className="nav-rail-status">
        {!outsideSpace ? (
          <div className="space-meta">
            <span>空间：{currentSpaceId}</span>
            <span>
              状态：
              {currentSpaceIsTemporary
                ? "临时空间"
                : spaceStatusLabels[currentSpaceStatus]}
            </span>
          </div>
        ) : (
          <div className="space-meta">
            <span>范围：本地空间工作台</span>
          </div>
        )}
      </div>

      <div className="nav-rail-actions">
        {!outsideSpace ? (
          <button onClick={() => leaveSpace()} type="button">
            离开空间
          </button>
        ) : null}
        <ThemeToggle />
      </div>
    </nav>
  );
}
