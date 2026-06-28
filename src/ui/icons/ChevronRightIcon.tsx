import { getIconProps, type IconProps } from "./types";

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...getIconProps(props)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
