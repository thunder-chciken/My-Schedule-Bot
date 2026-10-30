/** The app icon: a happy little calendar bot. Rendered to PNG with next/og. */
export function IconArt({ size, rounded = false }: { size: number; rounded?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #6CD3FF 0%, #1E8BFF 50%, #0A63E8 100%)',
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 100 100">
        <rect x="8" y="16" width="84" height="78" rx="20" fill="#FFFFFF" />
        <path d="M8 36 Q8 16 28 16 H72 Q92 16 92 36 V40 H8 Z" fill="#CFE6FF" />
        <rect x="27" y="5" width="11" height="22" rx="5.5" fill="#FFFFFF" />
        <rect x="62" y="5" width="11" height="22" rx="5.5" fill="#FFFFFF" />
        <circle cx="35" cy="60" r="7.5" fill="#0A72F5" />
        <circle cx="65" cy="60" r="7.5" fill="#0A72F5" />
        <path d="M34 75 Q50 88 66 75" stroke="#0A72F5" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}
