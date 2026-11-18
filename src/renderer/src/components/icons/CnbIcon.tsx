/** CNB ships no brand asset here; a "C" ring keeps source chips identifiable without inventing a logo. */
export function CnbIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      <path
        d="M18.5 7a8 8 0 1 0 0 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
