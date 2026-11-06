import { useState } from 'react'
import { SIDO_LIST, getPosition, nearestSido } from '../lib/geo.js'
import { saveSido } from '../lib/ui-helpers.js'

/** counts: { 서울: 2, ... } 를 주면 지역 이름 옆에 걷기길 개수를 표시 */
export default function SidoPicker({ value, onChange, counts, id = 'sido' }) {
  const [locating, setLocating] = useState(false)
  const [msg, setMsg] = useState('')
  const change = (s) => {
    if (s) saveSido(s)
    onChange(s)
  }
  const locate = async () => {
    setLocating(true)
    setMsg('')
    try {
      const p = await getPosition()
      change(nearestSido(p.lat, p.lng))
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLocating(false)
    }
  }
  return (
    <div className="sido-picker">
      <label className="field field--inline" htmlFor={id}>
        <span className="field__label">지역</span>
        <select id={id} value={value} onChange={(e) => change(e.target.value)}>
          {SIDO_LIST.map((s) => (
            <option key={s.short} value={s.short}>
              {s.full}
              {counts ? ` · 걷기길 ${counts[s.short] ?? 0}개` : ''}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn--ghost btn--sm" onClick={locate} disabled={locating}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
        {locating ? '찾는 중…' : '내 위치'}
      </button>
      {msg && <p className="hint hint--error">{msg}</p>}
    </div>
  )
}
