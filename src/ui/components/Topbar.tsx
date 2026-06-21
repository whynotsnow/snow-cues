import type { AppController } from "../useAppController";
import { spaceStatusLabels } from "../useAppController";
import type { AppPage } from "../appTypes";

type TopbarProps = {
  controller: AppController;
  navigateToPage: (page: AppPage) => void;
};

export function Topbar({ controller, navigateToPage }: TopbarProps) {
  const {
    activePage,
    currentSpaceId,
    currentSpaceStatus,
    currentSpaceIsTemporary,
    outsideSpace,
    storageDataOpened,
    storageDataDirty,
    storageDataMode,
    storageDataRevision,
    leaveSpace
  } = controller;

  return (
    <section className="sidebar" aria-label="应用状态">
      <div className="sidebar-brand">
        <p className="eyebrow">Snow Cues v2.0</p>
        <h1>安全本地密码系统</h1>
        <p className="subtitle">以用户维护的存储数据文件夹作为唯一业务数据源。</p>
      </div>
      <div className="sidebar-status">
        <div className="space-meta">
          <span>存储数据：{storageDataOpened ? `revision ${storageDataRevision}` : "未打开"}</span>
          <span>保存模式：{storageDataMode === "direct-folder" ? "直接保存" : storageDataMode === "download" ? "下载新版" : "待选择"}</span>
          <span>改动：{storageDataDirty ? "未保存" : "已同步到当前草稿"}</span>
        </div>
        {!outsideSpace ? (
          <div className="space-meta">
            <span>空间：{currentSpaceId}</span>
            <span>状态：{currentSpaceIsTemporary ? "临时空间" : spaceStatusLabels[currentSpaceStatus]}</span>
          </div>
        ) : (
          <div className="space-meta">
            <span>范围：本地空间工作台</span>
          </div>
        )}
      </div>
      <nav className="side-menu" aria-label="主导航">
        {outsideSpace ? (
          <>
            <button className={activePage === "detached" ? "" : "tab-active"} onClick={() => navigateToPage("space")} type="button">
              空间工作台
            </button>
            <button className={activePage === "detached" ? "tab-active" : ""} onClick={() => navigateToPage("detached")} type="button">
              游离密码
            </button>
          </>
        ) : (
          <>
            <button className={activePage === "space" ? "tab-active" : ""} onClick={() => navigateToPage("space")} type="button">
              空间主页
            </button>
            <button className={activePage === "rules" ? "tab-active" : ""} onClick={() => navigateToPage("rules")} type="button">
              规则管理
            </button>
            <button className={activePage === "groups" ? "tab-active" : ""} onClick={() => navigateToPage("groups")} type="button">
              输出适配
            </button>
            <button className={activePage === "passwords" ? "tab-active" : ""} onClick={() => navigateToPage("passwords")} type="button">
              密码管理
            </button>
          </>
        )}
      </nav>
      {!outsideSpace ? (
        <div className="sidebar-actions">
          <button onClick={() => leaveSpace()} type="button">
            离开空间
          </button>
        </div>
      ) : null}
    </section>
  );
}
