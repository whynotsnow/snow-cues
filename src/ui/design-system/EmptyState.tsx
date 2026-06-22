import type { ReactNode } from "react";

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export function EmptyState({ children, className = "" }: EmptyStateProps) {
  const classNames = ["empty-state", className].filter(Boolean).join(" ");
  return <p className={classNames}>{children}</p>;
}
