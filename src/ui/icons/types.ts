import type { SVGProps } from "react";

export type IconSize = 16 | 18 | 20;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: IconSize;
};

export function getIconProps({
  className = "",
  size = 18,
  ...props
}: IconProps) {
  return {
    "aria-hidden": true,
    className: ["sc-icon", className].filter(Boolean).join(" "),
    fill: "none",
    focusable: false,
    height: size,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    width: size,
    ...props
  };
}
