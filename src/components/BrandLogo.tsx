/** Calendar mark aligned with the app icon — cream card on the brand tile. */
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
      <rect x="5" y="6.5" width="14" height="13.5" rx="3" fill="#fffaf6" />
      <path
        d="M5 6.5c0-1.66 1.34-3 3-3h8c1.66 0 3 1.34 3 3v3.2H5V6.5z"
        fill="#ffe8d6"
      />
      <rect x="8.1" y="4.4" width="1.55" height="3.6" rx="0.75" fill="#fffaf6" />
      <rect x="14.35" y="4.4" width="1.55" height="3.6" rx="0.75" fill="#fffaf6" />
      <rect x="9.6" y="14.6" width="4.8" height="2.6" rx="1.1" fill="#5d9b82" />
    </svg>
  )
}
