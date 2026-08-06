/** Seal mark — nested stone frame, no letterform. */
export function BrandLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="4.35"
        y="4.35"
        width="15.3"
        height="15.3"
        rx="3.4"
        stroke="currentColor"
        strokeWidth="1.55"
      />
      <rect x="7.6" y="7.6" width="8.8" height="8.8" rx="2.1" fill="currentColor" />
      <rect x="10.15" y="11.35" width="3.7" height="1.35" rx="0.65" fill="#1a1612" />
    </svg>
  )
}
