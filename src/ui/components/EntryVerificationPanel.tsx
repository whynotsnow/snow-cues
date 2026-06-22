import type { ReactNode } from "react";
import { Notice } from "../notifications/Notice";
import type { NoticeMessage } from "../notifications/types";

export type VerificationEntryOption = {
  id: string;
  platform?: string;
  description?: string;
  updatedAt: number;
};

type EntryVerificationPanelProps = {
  title: string;
  description: string;
  entries: VerificationEntryOption[];
  selectedEntryId: string;
  selectLabel: string;
  onSelectEntry: (entryId: string) => void;
  children?: ReactNode;
  disabled?: boolean;
  feedback?: Pick<NoticeMessage, "tone" | "title" | "body">;
  submitLabel?: string;
  submittingLabel?: string;
  submitting?: boolean;
  onSubmit?: () => void;
  successDescription?: string;
  successNote?: string;
  verified?: boolean;
};

export function EntryVerificationPanel({
  title,
  description,
  entries,
  selectedEntryId,
  selectLabel,
  onSelectEntry,
  children,
  disabled = false,
  feedback,
  submitLabel,
  submittingLabel,
  submitting = false,
  onSubmit,
  successDescription,
  successNote,
  verified = false
}: EntryVerificationPanelProps) {
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;

  if (!selectedEntry && !verified) {
    return null;
  }

  return (
    <div className="verification-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <p>{verified ? successDescription ?? description : description}</p>
      </div>
      {verified ? (
        successNote ? <p className="login-note">{successNote}</p> : null
      ) : (
        <>
          {entries.length > 1 && selectedEntry ? (
            <label className="verification-entry-selector">
              {selectLabel}
              <select disabled={disabled || submitting} onChange={(event) => onSelectEntry(event.target.value)} value={selectedEntry.id}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {formatVerificationEntryLabel(entry)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {children}
          {feedback ? (
            <Notice
              notice={{
                scope: "field",
                tone: feedback.tone,
                title: feedback.title,
                body: feedback.body
              }}
            />
          ) : null}
          {onSubmit && submitLabel ? (
            <button disabled={disabled || submitting} onClick={onSubmit} type="button">
              {submitting ? submittingLabel ?? submitLabel : submitLabel}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function formatVerificationEntryLabel(entry: Pick<VerificationEntryOption, "platform" | "description" | "updatedAt">) {
  const name = entry.platform || entry.description || "未填写平台";
  return `${name} · ${new Date(entry.updatedAt).toLocaleString("zh-CN")}`;
}
