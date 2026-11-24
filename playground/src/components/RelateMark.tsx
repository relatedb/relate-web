import type { SVGProps } from 'react';

// The relate logomark: the two-legged arch from the brand kit (public/brand/02_Icon/SVG/relate-icon-cyan.svg),
// in the kit's cyan since the playground always uses Needle's dark theme.
export function RelateMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 292 239" role="img" aria-label="Relate logomark" fill="#8FE3E8" {...props}>
      <path d="M150.094 0C228.424 0 291.934 63.6447 291.934 142.142V229.849C291.934 234.903 287.837 239 282.783 239H198.854C193.8 239 189.703 234.903 189.703 229.849V142.142C189.703 120.259 171.93 102.449 150.094 102.449V0Z" />
      <path d="M141.84 0C63.5093 0 0 63.6447 0 142.142L0 229.849C0 234.903 4.09702 239 9.15095 239H93.0801C98.134 239 102.231 234.903 102.231 229.849V142.142C102.231 120.259 120.003 102.449 141.84 102.449V0Z" />
    </svg>
  );
}
