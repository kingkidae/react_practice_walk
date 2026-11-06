import { useState } from 'react'

/** 기상청 기상특보 — 해당 지역에 발효 중인 특보 */
export default function WarningBanner({ warnings }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="notice notice--warn" role="alert">
      <div className="notice__row">
        <strong>기상특보 발효 중</strong>
        <span>{warnings.items.join(', ')}</span>
        <button className="link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? '접기' : '자세히'}</button>
      </div>
      {open && (
        <ul className="notice__list">
          {warnings.detail.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
      <p className="hint">특보 중에는 산책을 짧게 하거나 실내 놀이로 대신해 주세요.</p>
    </div>
  )
}
