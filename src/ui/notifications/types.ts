import type { AppPage } from "../appTypes";

export type NoticeScope = "system" | "page" | "section" | "action" | "field";

export type NoticeTone = "info" | "warning" | "success" | "error";

export type NoticeMessage = {
  id?: string;
  scope: NoticeScope;
  tone: NoticeTone;
  title: string;
  body?: string;
  action?: {
    label: string;
    targetPage: AppPage;
  };
};

export type SystemNotificationPermission =
  | NotificationPermission
  | "unsupported";
