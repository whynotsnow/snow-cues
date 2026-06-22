import type { ReactNode } from "react";

export type DescriptionListItem = {
  label: ReactNode;
  value: ReactNode;
};

type DescriptionListProps = {
  className?: string;
  items: DescriptionListItem[];
};

export function DescriptionList({
  className = "",
  items
}: DescriptionListProps) {
  const classNames = ["entry-readonly-grid", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      {items.map((item, index) => (
        <div key={index}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
