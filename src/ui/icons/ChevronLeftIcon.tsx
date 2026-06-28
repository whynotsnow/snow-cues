import { getIconProps, type IconProps } from "./types";

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...getIconProps(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
