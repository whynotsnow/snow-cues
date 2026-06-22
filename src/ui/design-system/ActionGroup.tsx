import type { ReactNode } from "react";

type ActionGroupVariant = "default" | "entry" | "tool" | "compact";

type ActionGroupProps = {
  children: ReactNode;
  className?: string;
  variant?: ActionGroupVariant;
};

const actionGroupClasses: Record<ActionGroupVariant, string> = {
  default: "actions",
  entry: "entry-actions",
  tool: "tool-actions",
  compact: "entry-actions compact-actions"
};

export function ActionGroup({ children, className = "", variant = "default" }: ActionGroupProps) {
  const classNames = [actionGroupClasses[variant], className].filter(Boolean).join(" ");
  return <div className={classNames}>{children}</div>;
}
