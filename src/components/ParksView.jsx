import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../lib/api.js'
import { fmtArea, fmtKm, parkLoopKm, SIDO_LIST } from '../lib/geo.js'
import { pinIcon } from '../lib/ui-helpers.js'
import { Loading, ErrorBox, Empty } from './ui.jsx'
import MapView from './MapView.jsx'

const PAGE = 20

/** 전국도시공원정보표준데이터 — 지역별 걷기 좋은 공원 */
export default function ParksView({ sido }) {
  const { data, error, loading } = useApi(`/api/parks?sido=${encodeURIComponent(sido)}`)
  const [sigungu, setSigungu] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [focus, setFocus] = useState(null)
  const navigate = useNavigate()

  const sggs = useMemo(() => [...new Set((data || []).map((p) => p.sigungu).filter(Boolean))].sort(), [data])
  const list = useMemo(() => {
    const kw = q.trim()
    return (data || []).filter((p) => (!sigungu || p.sigungu === sigungu) && (!kw || p.name.includes(kw) || p.addr.includes(kw)))
  }, [data, sigungu, q])
  const visible = list.slice(0, limit)
  const center = SIDO_LIST.find((s) => s.short === sido)?.center

  if (loading) return <Loading text="공원 정보를 불러오고 있어요" />
  if (error) return <ErrorBox error={error} />
  if (!data) return null

  return (
    <>
      <div className="filters">
        <label className="field field--inline" htmlFor="park-sgg">
          <span className="field__label">시군구</span>
          <select id="park-sgg" value={sigungu} onChange={(e) => { setSigungu(e.target.value); setLimit(PAGE) }}>
            <option value="">전체</option>
            {sggs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field field--grow" htmlFor="park-q">
          <span className="field__label">검색</span>
          <input id="park-q" type="search" placeholder="공원 이름이나 주소" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} />
        </label>
      </div>
      <div className="split">
        <div className="split__map">
          <MapView
            className="map--sticky"
            label="공원 지도"
            center={center}
            zoom={11}
            flyTo={focus}
            fit={visible.map((p) => [p.lat, p.lng])}
            markers={visible.map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              icon: pinIcon({ kind: 'dot', color: 'var(--leaf)', active: focus && focus[0] === p.lat && focus[1] === p.lng }),
              popup: (
                <div className="popup">
                  <strong>{p.name}</strong>
                  <span>{p.kind} · {fmtArea(p.areaM2)}</span>
                  <button className="link-btn" onClick={() => navigate(`/walk/${sido}/${encodeURIComponent(p.id)}`)}>산책지수 보기</button>
                </div>
              ),
            }))}
          />
        </div>
        <div className="split__list">
          <p className="count">걷기 좋은 공원 {list.length}곳 (면적 큰 순)</p>
          {!list.length && <Empty title="조건에 맞는 공원이 없어요">검색어나 시군구를 바꿔 보세요.</Empty>}
          <ul className="trail-list">
            {visible.map((p) => {
              const loop = parkLoopKm(p.areaM2)
              return (
                <li key={p.id} className="trail-card">
                  <Link to={`/walk/${sido}/${encodeURIComponent(p.id)}`} className="trail-card__link">
                    <div className="trail-card__top">
                      <span className="level" style={{ '--lv': 'var(--leaf)' }}>{p.kind}</span>
                    </div>
                    <strong className="trail-card__name">{p.name}</strong>
                    <span className="trail-card__meta">{p.addr}</span>
                    <dl className="mini-stats">
                      <div><dt>면적</dt><dd>{fmtArea(p.areaM2)}</dd></div>
                      {loop && <div><dt>한 바퀴</dt><dd>약 {fmtKm(loop)}</dd></div>}
                    </dl>
                    {Object.keys(p.facilities).length > 0 && (
                      <p className="trail-card__summary">{Object.entries(p.facilities).map(([k, v]) => `${k}: ${v}`).join(' / ')}</p>
                    )}
                  </Link>
                  <button className="link-btn trail-card__locate" onClick={() => setFocus([p.lat, p.lng])}>지도에서 보기</button>
                </li>
              )
            })}
          </ul>
          {list.length > limit && (
            <button className="btn btn--ghost btn--block" onClick={() => setLimit((l) => l + PAGE)}>더 보기 ({list.length - limit}곳 남음)</button>
          )}
          <p className="fine">출처: 전국도시공원정보표준데이터. 어린이공원·소공원은 제외했고, 한 바퀴 거리는 면적으로 계산한 대략값이에요.</p>
        </div>
      </div>
    </>
  )
}
