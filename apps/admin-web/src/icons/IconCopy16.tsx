import type { FC, HTMLProps } from "react";

export const IconCopy16: FC<HTMLProps<SVGSVGElement>> = (props) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" />
    <path
      d="M10.5 5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1"
      stroke="currentColor"
    />
  </svg>
);
