import { getIconProps, type IconProps } from "./types";

export function SpaceIcon(props: IconProps) {
  return (
    <svg {...getIconProps(props)}>
      <path d="M12 3 21 12 12 21 3 12 12 3Z" />
      <path d="M12 8 16 12 12 16 8 12 12 8Z" />
    </svg>
  );
}
