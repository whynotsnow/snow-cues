import type { AppController } from "./useAppController";
import type { NoticeMessage } from "./notifications/types";

type PageNoticeInput = Pick<
  AppController,
  "activePage" | "currentSpaceStatus" | "outsideSpace" | "verificationPending"
>;

export function getPageNotice({
  activePage,
  currentSpaceStatus,
  outsideSpace,
  verificationPending
}: PageNoticeInput): NoticeMessage | null {
  if (outsideSpace) {
    return null;
  }

  if (currentSpaceStatus === "deprecated") {
    return {
      scope: "page",
      tone: "info",
      title: "历史存储空间",
      body: "当前空间已标记为历史，通常表示已有后继空间接替。本空间不再用于日常维护，创建、编辑、废弃、规则变更和迁移管理均不可用。"
    };
  }

  if (currentSpaceStatus === "archived") {
    return {
      scope: "page",
      tone: "warning",
      title: "归档存储空间",
      body: "当前空间已归档，仅保留受限查看能力。创建、编辑、废弃、规则变更和日常派生均不可用。"
    };
  }

  if (activePage === "passwords") {
    if (verificationPending) {
      return {
        scope: "page",
        tone: "warning",
        title: "需要先完成空间校验",
        body: "当前空间已有密码。请先在空间主页选择条目并完成校验，完成前密码管理页只展示列表状态。",
        action: {
          label: "前往空间主页",
          targetPage: "space"
        }
      };
    }
  }

  return null;
}
