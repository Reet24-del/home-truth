/**
 * The mark: a filed sheet with a folded corner, and on it a building whose
 * top two floors are drawn in outline. Solid floors are the record; outlined
 * floors are what was advertised. The whole product in 24 pixels.
 */
export function Logo({size = 34}: {size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Home Truth"
      className="logo"
      fill="none"
    >
      {/* sheet with a folded corner */}
      <path
        d="M4 2.5h16.5L28 10v19.5H4z"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M20.5 2.5V10H28" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />

      {/* advertised floors: drawn, not built */}
      <rect x="10" y="12" width="12" height="3" stroke="var(--critical)" strokeWidth="1.4" strokeDasharray="2.4 1.8" />
      <rect x="10" y="16.4" width="12" height="3" stroke="var(--critical)" strokeWidth="1.4" strokeDasharray="2.4 1.8" />

      {/* the sanctioned line */}
      <path d="M8 20.9h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />

      {/* floors that exist */}
      <rect x="10" y="22.3" width="12" height="2.6" fill="currentColor" />
      <rect x="10" y="25.7" width="12" height="2.6" fill="currentColor" />
    </svg>
  )
}
