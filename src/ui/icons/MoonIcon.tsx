import { getIconProps, type IconProps } from "./types";

export function MoonIcon(props: IconProps) {
  return (
    <svg {...getIconProps(props)}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11Z" />
    </svg>
  );
}
