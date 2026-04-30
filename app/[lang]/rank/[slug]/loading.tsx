export default function RankSlugLoading() {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px 60px' }}>
      {/* Breadcrumb + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 4px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 14, borderRadius: 4, background: 'var(--bg-subtle)' }} />
          <span style={{ color: 'var(--fg-7)' }}>/</span>
          <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--bg-subtle)' }} />
        </div>
        <div style={{ width: 120, height: 28, borderRadius: 7, background: 'var(--bg-subtle)' }} />
      </div>

      {/* Title */}
      <div style={{ width: 300, height: 32, borderRadius: 6, background: 'var(--bg-subtle)', marginBottom: 20 }} />

      {/* Sort tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[80, 60, 60, 80, 80].map((w, i) => (
          <div key={i} style={{ width: w, height: 28, borderRadius: 20, background: 'var(--bg-subtle)' }} />
        ))}
      </div>

      {/* Entry rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '28px 48px 1fr auto',
            alignItems: 'center', gap: 14, padding: '14px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            opacity: 1 - i * 0.05,
          }}>
            <div style={{ width: 24, height: 18, borderRadius: 3, background: 'var(--bg-subtle)' }} />
            <div style={{ width: 48, height: 68, borderRadius: 6, background: 'var(--bg-subtle)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: `${160 - i * 6}px`, height: 14, borderRadius: 4, background: 'var(--bg-subtle)' }} />
              <div style={{ width: 90, height: 4, borderRadius: 2, background: 'var(--bg-subtle)' }} />
            </div>
            <div style={{ width: 48, height: 32, borderRadius: 6, background: 'var(--bg-subtle)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
