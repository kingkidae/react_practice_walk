import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Loading, ErrorBox, Empty } from './ui.jsx'

/** 최근 60일 구조동물 목록을 보호소별로 묶어 보여준다 */
export default function Shelters({ sidoList, onPick, defaultUpr = '' }) {
  const [upr, setUpr] = useState(defaultUpr)
  const res = useApi(upr ? `/api/shelters?upr_cd=${upr}` : null)
  return (
    <>
      <div className="filters">
        <label className="field field--inline" htmlFor="sh-sido">
          <span className="field__label">시도</span>
          <select id="sh-sido" value={upr} onChange={(e) => setUpr(e.target.value)}>
            <option value="">시도를 골라 주세요</option>
            {sidoList.map((s) => <option key={s.orgCd} value={s.orgCd}>{s.orgdownNm}</option>)}
          </select>
        </label>
      </div>
      {!upr && <Empty title="어느 지역 보호소를 볼까요?">시도를 고르면 최근 60일 동안 아이들을 보호한 보호소와 보호 두수를 보여드려요.</Empty>}
      {res.loading && <Loading text="보호소를 모으고 있어요" />}
      {res.error && <ErrorBox error={res.error} />}
      {res.data && (
        <>
          <p className="count">보호소 {res.data.length}곳 · 최근 60일 구조 기준</p>
          <ul className="shelter-list">
            {res.data.map((s) => (
              <li key={s.id || s.name} className="shelter-card">
                <strong className="shelter-card__name">{s.name}</strong>
                <span className="muted">{s.org}</span>
                <dl className="shelter-card__nums">
                  <div><dt>보호 중</dt><dd>{s.protect}</dd></div>
                  <div><dt>공고 중</dt><dd>{s.notice}</dd></div>
                  <div><dt>강아지</dt><dd>{s.dogs}</dd></div>
                  <div><dt>고양이</dt><dd>{s.cats}</dd></div>
                </dl>
                {s.addr && <p className="muted shelter-card__addr">{s.addr}</p>}
                <div className="actions">
                  <button className="btn btn--sm" onClick={() => onPick({ id: s.id, name: s.name, uprCd: upr })}>이 보호소 아이들 보기</button>
                  {s.tel && <a className="btn btn--ghost btn--sm" href={`tel:${s.tel.replace(/[^\d]/g, '')}`}>{s.tel}</a>}
                  {s.addr && <a className="btn btn--ghost btn--sm" href={`https://map.kakao.com/link/search/${encodeURIComponent(s.addr)}`} target="_blank" rel="noreferrer">위치</a>}
                </div>
              </li>
            ))}
          </ul>
          <p className="fine">보호소 운영시간과 방문 가능 여부는 전화로 먼저 확인해 주세요.</p>
        </>
      )}
    </>
  )
}
