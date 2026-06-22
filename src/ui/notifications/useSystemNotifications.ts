import { useCallback, useEffect, useState } from "react";
import type { NoticeMessage, SystemNotificationPermission } from "./types";

type BrowserNotificationConstructor = {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  new(title: string, options?: NotificationOptions): Notification;
};

function getBrowserNotification(): BrowserNotificationConstructor | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  return window.Notification as BrowserNotificationConstructor;
}

function canUseBrowserNotification() {
  return typeof window !== "undefined" && window.isSecureContext !== false;
}

function normalizeSystemNotice(notice: Omit<NoticeMessage, "scope"> & { scope?: "system" }): NoticeMessage {
  return {
    ...notice,
    scope: "system",
    id: notice.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
}

export function useSystemNotifications() {
  const [permission, setPermission] = useState<SystemNotificationPermission>(() => {
    const NotificationApi = getBrowserNotification();
    if (!NotificationApi || !canUseBrowserNotification()) {
      return "unsupported";
    }
    return NotificationApi.permission;
  });
  const [systemNotices, setSystemNotices] = useState<NoticeMessage[]>([]);

  useEffect(() => {
    const NotificationApi = getBrowserNotification();
    if (!NotificationApi || !canUseBrowserNotification()) {
      setPermission("unsupported");
      return;
    }

    setPermission(NotificationApi.permission);
  }, []);

  const dismissSystemNotice = useCallback((noticeId: string) => {
    setSystemNotices((current) => current.filter((notice) => notice.id !== noticeId));
  }, []);

  const notifySystem = useCallback((input: Omit<NoticeMessage, "scope"> & { scope?: "system" }) => {
    const notice = normalizeSystemNotice(input);
    const NotificationApi = getBrowserNotification();
    const livePermission = NotificationApi && canUseBrowserNotification() ? NotificationApi.permission : permission;

    if (NotificationApi && livePermission === "granted" && canUseBrowserNotification()) {
      try {
        new NotificationApi(notice.title, {
          body: notice.body
        });
        return;
      } catch {
        setPermission("unsupported");
      }
    }

    setSystemNotices((current) => [notice, ...current].slice(0, 3));
  }, [permission]);

  const clearSystemNotices = useCallback(() => {
    setSystemNotices([]);
  }, []);

  return {
    systemNotificationPermission: permission,
    systemNotices,
    notifySystem,
    dismissSystemNotice,
    clearSystemNotices
  };
}
