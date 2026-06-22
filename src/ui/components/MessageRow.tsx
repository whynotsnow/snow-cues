import { useEffect, useState } from "react";
import type { AppController } from "../useAppController";
import { Notice } from "../notifications/Notice";

type MessageRowProps = {
  controller: AppController;
};

export function MessageRow({ controller }: MessageRowProps) {
  const { error, status } = controller;
  const [visibleStatus, setVisibleStatus] = useState(status);

  useEffect(() => {
    setVisibleStatus(status);
    if (!status) {
      return;
    }
    const timer = window.setTimeout(() => setVisibleStatus(""), 4500);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!error && !visibleStatus) {
    return null;
  }

  return (
    <div className="message-row" aria-label="操作反馈" aria-live="polite">
      {error ? (
        <Notice notice={{ scope: "action", tone: "error", title: "操作失败", body: error }} />
      ) : null}
      {!error && visibleStatus ? (
        <Notice notice={{ scope: "action", tone: "success", title: "操作完成", body: visibleStatus }} />
      ) : null}
    </div>
  );
}
