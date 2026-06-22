import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = "",
  disabled,
  loading = false,
  loadingLabel,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  const classNames = [
    variant === "primary" ? "primary-button" : "",
    variant === "ghost" ? "ds-button-ghost" : "",
    size === "sm" ? "ds-button-sm" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={classNames || undefined}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}
