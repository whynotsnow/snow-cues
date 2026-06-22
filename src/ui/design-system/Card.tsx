import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type CardTone = "section" | "subtle";

export type CardProps<TElement extends ElementType = "section"> = {
  as?: TElement;
  children: ReactNode;
  className?: string;
  tone?: CardTone;
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "children" | "className">;

export function Card<TElement extends ElementType = "section">({
  as,
  children,
  className = "",
  tone = "section",
  ...props
}: CardProps<TElement>) {
  const Component = as ?? "section";
  const classNames = [
    tone === "section" ? "section-card" : "ds-card-subtle",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component {...props} className={classNames}>
      {children}
    </Component>
  );
}
