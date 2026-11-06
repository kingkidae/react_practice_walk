import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApi, qs } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { fmtKm, fmtMinutes, LEVEL_LABEL, sidoOf } from '../lib/geo.js'
import { Loading, ErrorBox } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { pinIcon, levelColor } from '../lib/ui-helpers.js'

export default function TrailDetail() {
  const { id } = useParams()
  const { data, error, loading } = useApi(`/api/trails/track?id=${encodeURIComponent(id)}`)
  const [hover, setHover] = useState(null)
  const mc = data?.course
  usePageMeta({
    title: mc ? `${mc.name} 코스 지도·거리·난이도` : '산책로 상세',
    description: mc ? `${mc.sigun} ${mc.name}: ${mc.distanceKm}km, 약 ${Math.round((mc.minutes || 0) / 60)}시간. ${(mc.summary || '').replace(/s+/g, ' ').slice(0, 90)}` : undefined,
  })

  if (loading) return <div className="page"><Loading text="경로를 그리고 있어요" /></div>
  if (error) return <div className="page"><Link to="/trails" className="back">산책로 목록</Link><ErrorBox error={error} /></div>

  const { course: c, track: t } = data
  const line = t.points.map((p) => [p[0], p[1]])
  const isLoop = /^순환/.test(c.cycle || '') || distance(t.start, t.end) < 0.15
  const sido = sidoOf(c.sigun)

  return (
    <div className="page">
      <Link to="/trails" className="back">산책로 목록</Link>

      <header className="page-head">
        <div className="trail-card__top">
          <span className="level" style={{ '--lv': levelColor(c.level) }}>{LEVEL_LABEL[c.level] || '난이도 정보 없음'}</span>
          {c.cycle && <span className="chip chip--plain">{c.cycle}</span>}
          {c.theme?.name && <span className="chip chip--plain">{c.theme.name}</span>}
        </div>
        <h1 className="page-title page-title--sm">{c.name}</h1>
        <p className="muted">{c.sigun}</p>
      </header>

      <MapView
        className="map--tall"
        label="산책 경로 지도"
        fit={line}
        lines={[
          { id: 'halo', points: line, color: '#FFFFFF', weight: 9 },
          { id: 'route', points: line, color: '#C98A3D', weight: 5 },
        ]}
        markers={[
          ...(hover != null ? [{ id: 'h', lat: t.points[hover][0], lng: t.points[hover][1], icon: pinIcon({ kind: 'dot', color: 'var(--ink)', active: true }), z: 30 }] : []),
          isLoop
            ? { id: 's', lat: t.start.lat, lng: t.start.lng, icon: pinIcon({ text: '출발', color: 'var(--leaf)' }), z: 10, popup: '출발·도착 지점 (순환형)' }
            : { id: 's', lat: t.start.lat, lng: t.start.lng, icon: pinIcon({ text: '출발', color: 'var(--leaf)' }), z: 10, popup: '출발 지점' },
          ...(isLoop ? [] : [{ id: 'e', lat: t.end.lat, lng: t.end.lng, icon: pinIcon({ text: '도착', color: 'var(--ink)' }), popup: '도착 지점' }]),
        ]}
      />

      <dl className="stat-strip">
        <Stat label="코스 거리" value={fmtKm(c.distanceKm)} sub="두루누비 공식" />
        <Stat label="경로 측정 거리" value={fmtKm(t.distanceKm)} sub="GPX 경로 합산" />
        <Stat label="예상 소요" value={fmtMinutes(c.minutes)} />
        <Stat label="형태" value={isLoop ? '순환형' : '편도'} sub={c.cycle || ''} />
        {t.elevation && <Stat label="고도" value={`${t.elevation.min}~${t.elevation.max}m`} sub={`누적 오르막 ${t.elevation.gain}m`} />}
      </dl>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel__title">출발과 도착</h2>
          <ul className="endpoints">
            <li>
              <span className="endpoints__dot" style={{ background: 'var(--leaf)' }} />
              <div>
                <strong>{isLoop ? '출발·도착' : '출발'}</strong>
                <span className="muted">{t.start.lat.toFixed(5)}, {t.start.lng.toFixed(5)}</span>
              </div>
              <a className="btn btn--ghost btn--sm" href={`https://map.kakao.com/link/to/${encodeURIComponent(c.name + ' 출발')},${t.start.lat},${t.start.lng}`} target="_blank" rel="noreferrer">길찾기</a>
            </li>
            {!isLoop && (
              <li>
                <span className="endpoints__dot" style={{ background: 'var(--ink)' }} />
                <div>
                  <strong>도착</strong>
                  <span className="muted">{t.end.lat.toFixed(5)}, {t.end.lng.toFixed(5)}</span>
                </div>
                <a className="btn btn--ghost btn--sm" href={`https://map.kakao.com/link/map/${encodeURIComponent(c.name + ' 도착')},${t.end.lat},${t.end.lng}`} target="_blank" rel="noreferrer">지도</a>
              </li>
            )}
          </ul>
          <div className="actions">
            {sido && <Link className="btn" to={`/walk/${sido}/${c.id}`}>지금 산책지수 보기</Link>}
            <Link className="btn btn--ghost" to={`/calories?${qs({ km: c.distanceKm ?? t.distanceKm, min: c.minutes, name: c.name })}`}>칼로리 계산</Link>
          </div>
        </section>

        {t.elevation && t.elevation.max - t.elevation.min >= 1 ? (
          <section className="panel">
            <h2 className="panel__title">고도 변화</h2>
            <ElevationChart points={t.points} onHover={setHover} />
          </section>
        ) : (
          <section className="panel">
            <h2 className="panel__title">길 한눈에 보기</h2>
            <p>{c.summary || '요약 정보가 없어요.'}</p>
          </section>
        )}
      </div>

      <section className="panel prose">
        {c.summary && <TextBlock title="코스 개요" text={c.summary} />}
        {c.contents && <TextBlock title="코스 설명" text={c.contents} />}
        {c.theme?.desc && <TextBlock title={`길 이야기 · ${c.theme.name}`} text={c.theme.desc} />}
        {c.tourInfo && <TextBlock title="주변 볼거리" text={c.tourInfo} />}
        {c.travelerInfo && <TextBlock title="편의 정보" text={c.travelerInfo} />}
        <p className="fine">
          출처: 한국관광공사 두루누비{c.modified ? ` · 정보 수정일 ${c.modified.slice(0, 10)}` : ''}. 반려견 동반 가능 여부는 구간마다 다를 수 있으니 현장 안내를 확인해 주세요.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        {sub && <span>{sub}</span>}
      </dd>
    </div>
  )
}

function TextBlock({ title, text }) {
  return (
    <>
      <h2 className="panel__title">{title}</h2>
      {text.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
    </>
  )
}

function ElevationChart({ points, onHover }) {
  // 실제 표시 폭에 맞춰 그려서 작은 화면에서도 글자 크기가 유지되게 한다
  const ref = useRef(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="elev-wrap">
      <ElevationSvg points={points} onHover={onHover} W={W} />
    </div>
  )
}

function ElevationSvg({ points, onHover, W }) {
  const pts = points.filter((p) => p[2] != null)
  const H = W < 420 ? 160 : 190, P = { l: 44, r: 8, t: 12, b: 26 }
  const maxD = pts[pts.length - 1][3] || 1
  const eles = pts.map((p) => p[2])
  const lo = Math.floor(Math.min(...eles) / 10) * 10
  const hi = Math.ceil(Math.max(...eles) / 10) * 10 || lo + 10
  const x = (d) => P.l + (d / maxD) * (W - P.l - P.r)
  const y = (e) => P.t + (1 - (e - lo) / (hi - lo || 1)) * (H - P.t - P.b)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[3]).toFixed(1)},${y(p[2]).toFixed(1)}`).join('')
  const area = `${path}L${x(maxD)},${H - P.b}L${x(0)},${H - P.b}Z`
  const ticks = (W < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => f * maxD)

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const d = ((e.clientX - r.left) / r.width * W - P.l) / (W - P.l - P.r) * maxD
    let best = 0
    for (let i = 0; i < points.length; i++) if (Math.abs(points[i][3] - d) < Math.abs(points[best][3] - d)) best = i
    onHover(best)
  }

  return (
    <svg className="elev" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`고도 ${lo}m에서 ${hi}m 사이`} onPointerMove={move} onPointerLeave={() => onHover(null)}>
      <line x1={P.l} x2={W - P.r} y1={y(hi)} y2={y(hi)} className="elev__grid" />
      <line x1={P.l} x2={W - P.r} y1={y(lo)} y2={y(lo)} className="elev__grid" />
      <text x={P.l - 6} y={y(hi) + 4} className="elev__label" textAnchor="end">{hi}m</text>
      <text x={P.l - 6} y={y(lo) + 4} className="elev__label" textAnchor="end">{lo}m</text>
      <path d={area} className="elev__area" />
      <path d={path} className="elev__line" />
      {ticks.map((d, i) => (
        <text key={d} x={x(d)} y={H - 6} className="elev__label" textAnchor={i === ticks.length - 1 ? 'end' : 'middle'}>{d.toFixed(1)}km</text>
      ))}
    </svg>
  )
}

function distance(a, b) {
  const dx = (a.lat - b.lat) * 111
  const dy = (a.lng - b.lng) * 88
  return Math.sqrt(dx * dx + dy * dy)
}
