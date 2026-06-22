import type { AppController } from "../useAppController";
import { Notice } from "../notifications/Notice";

type SystemNoticeHostProps = {
  controller: AppController;
};

export function SystemNoticeHost({ controller }: SystemNoticeHostProps) {
  const { systemNotices, dismissSystemNotice } = controller;

  if (systemNotices.length === 0) {
    return null;
  }

  return (
    <section className="system-notice-host" aria-label="系统通知">
      {systemNotices.map((notice) => (
        <div className="system-notice-item" key={notice.id}>
          <Notice notice={notice} />
          {notice.id ? (
            <button onClick={() => dismissSystemNotice(notice.id!)} type="button">
              关闭
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}
