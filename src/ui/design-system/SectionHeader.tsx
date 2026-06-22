import type { ReactNode } from "react";

type SectionHeaderProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
};

export function SectionHeader({
  actions,
  children,
  className = "",
  description,
  title
}: SectionHeaderProps) {
  const classNames = ["section-header", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions}
    </div>
  );
}
