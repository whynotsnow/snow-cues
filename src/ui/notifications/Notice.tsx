import type { NoticeMessage } from "./types";

type NoticeProps = {
  notice: NoticeMessage;
  className?: string;
  onAction?: () => void;
};

export function Notice({ notice, className = "", onAction }: NoticeProps) {
  const role =
    notice.tone === "warning" || notice.tone === "error" ? "alert" : "status";
  const classNames = [
    "notice",
    `notice-${notice.scope}`,
    `notice-${notice.tone}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} role={role}>
      <div>
        <strong>{notice.title}</strong>
        {notice.body ? <span>{notice.body}</span> : null}
      </div>
      {notice.action && onAction ? (
        <button
          className="notice-action-button"
          onClick={onAction}
          type="button"
        >
          {notice.action.label}
        </button>
      ) : null}
    </div>
  );
}
