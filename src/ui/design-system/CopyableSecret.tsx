import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";

type CopyState = "idle" | "copied" | "blocked";

export type CopyableSecretProps = {
  actions?: ReactNode;
  className?: string;
  copyLabel?: string;
  copyValue?: string;
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

export function CopyableSecret({
  actions,
  className = "",
  copyLabel = "复制",
  copyValue,
  disabled = false,
  label,
  value
}: CopyableSecretProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resolvedCopyValue = copyValue ?? value;
  const canCopy = Boolean(resolvedCopyValue) && !disabled;
  const classNames = ["copyable-secret", className].filter(Boolean).join(" ");

  useEffect(() => {
    setCopyState("idle");
  }, [value]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }
    const timeout = window.setTimeout(() => setCopyState("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function handleCopy() {
    if (!canCopy) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyState("blocked");
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedCopyValue);
      setCopyState("copied");
    } catch {
      setCopyState("blocked");
    }
  }

  return (
    <div className={classNames}>
      <div className="copyable-secret-main">
        <span className="copyable-secret-label">{label}</span>
        <code>{value}</code>
      </div>
      {canCopy || actions ? (
        <div className="copyable-secret-controls">
          {canCopy ? (
            <Button onClick={() => void handleCopy()} size="sm">
              {copyLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
      {copyState !== "idle" ? (
        <p className="copyable-secret-status" role="status">
          {copyState === "copied"
            ? "已复制。"
            : "当前浏览器不允许自动复制，请手动复制。"}
        </p>
      ) : null}
    </div>
  );
}
