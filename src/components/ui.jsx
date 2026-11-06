import { toneColor } from '../lib/ui-helpers.js'


// 강아지 인식표 모양의 점수 배지
export function ScoreTag({ score, tone, size = 76, label }) {
  const r = 42
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="score-tag" style={{ width: size, height: size * 1.12, '--tone': toneColor(tone) }} role="img" aria-label={`산책지수 ${score}점${label ? `, ${label}` : ''}`}>
      <svg viewBox="0 0 100 112" width={size} height={size * 1.12} aria-hidden="true">
        <circle cx="50" cy="7" r="5" fill="none" stroke="var(--line-strong)" strokeWidth="3" />
        <circle cx="50" cy="60" r="47" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
        <circle cx="50" cy="60" r={r} fill="none" stroke="var(--track)" strokeWidth="7" />
        <circle
          cx="50" cy="60" r={r} fill="none" stroke="var(--tone)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 50 60)"
        />
      </svg>
      <span className="score-tag__num" style={{ fontSize: size * 0.34 }}>{score}</span>
    </div>
  )
}

export function Paw({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={color}>
      <ellipse cx="12" cy="16.2" rx="5.2" ry="4.4" />
      <ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.8" />
      <ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.8" />
      <ellipse cx="9" cy="5.6" rx="2.1" ry="2.8" />
      <ellipse cx="15" cy="5.6" rx="2.1" ry="2.8" />
    </svg>
  )
}

export function Loading({ text = '불러오는 중이에요' }) {
  return (
    <div className="loading" role="status">
      <div className="loading__paws" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 0.25}s` }}>
            <Paw size={20} />
          </span>
        ))}
      </div>
      <p>{text}</p>
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  const api = error?.info?.api
  return (
    <div className="notice notice--error" role="alert">
      <strong>데이터를 가져오지 못했어요.</strong>
      <p>{error?.message}</p>
      {api && (
        <p>
          필요한 API: <a href={api.url} target="_blank" rel="noreferrer">{api.name}</a>
        </p>
      )}
      {onRetry && <button className="btn btn--ghost" onClick={onRetry}>다시 시도</button>}
    </div>
  )
}

export function Segmented({ options, value, onChange, label, wrap }) {
  return (
    <div className={`segmented${wrap ? ' segmented--wrap' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <svg width="88" height="64" viewBox="0 0 88 64" aria-hidden="true">
        <ellipse cx="44" cy="56" rx="30" ry="5" fill="var(--track)" />
        <path d="M22 44c0-14 10-24 22-24s22 10 22 24v6H22z" fill="var(--golden-light)" />
        <path d="M24 24c-6 2-9 12-6 18 4-2 7-8 8-14zM64 24c6 2 9 12 6 18-4-2-7-8-8-14z" fill="var(--golden)" />
        <circle cx="37" cy="34" r="2.4" fill="var(--ink)" />
        <circle cx="51" cy="34" r="2.4" fill="var(--ink)" />
        <ellipse cx="44" cy="41" rx="3.4" ry="2.4" fill="var(--ink)" />
      </svg>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}
