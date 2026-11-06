import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { computeWalkScore, pmGrade, PTY_LABEL, uvGrade, POLLEN_LABEL } from '../lib/walkScore.js'
import { useDogProfile } from '../lib/dogProfile.js'
import { kstParts, uvAt, pollenToday } from '../lib/indices.js'
import ShareButton from '../components/ShareButton.jsx'
import WarningBanner from '../components/WarningBanner.jsx'
import { fmtKm, fmtMinutes, fmtArea, LEVEL_LABEL, SIDO_LIST, nearbyWithCourses } from '../lib/geo.js'
import { ScoreTag, Loading, ErrorBox, Segmented } from '../components/ui.jsx'
import SidoPicker from '../components/SidoPicker.jsx'
import MapView from '../components/MapView.jsx'
import { pinIcon, loadSido, saveSido, toneColor } from '../lib/ui-helpers.js'

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'short', label: '15km 이하' },
  { value: 'easy', label: '쉬운 길' },
  { value: 'loop', label: '순환형' },
]

export default function WalkIndex() {
  const [sido, setSido] = useState(() => loadSido('서울'))
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('list')
  const [showAllParks, setShowAllParks] = useState(false)
  const { data, error, loading } = useApi(`/api/walk/region?sido=${encodeURIComponent(sido)}`)
  const navigate = useNavigate()
  const profile = useDogProfile()
  const idx = useApi(`/api/indices?sido=${encodeURIComponent(sido)}`)
  const [{ ymd, hh, month }] = useState(() => kstParts())
  const uv = uvAt(idx.data?.uv?.series, ymd, hh)
  const pollen = pollenToday(idx.data?.pollen)
  const opts = useMemo(() => ({ profile, uv, pollen, month }), [profile, uv, pollen, month])
  usePageMeta({
    title: `${SIDO_LIST.find((s) => s.short === sido)?.full ?? ''} 강아지 산책지수`,
    description: `지금 ${SIDO_LIST.find((s) => s.short === sido)?.full ?? '우리 동네'} 날씨·미세먼지로 계산한 반려견 산책지수와 걷기길·공원별 산책하기 좋은 곳을 확인하세요.`,
  })

  const here = useMemo(() => (data ? { ...data.here, score: computeWalkScore({ weather: data.here.weather, air: data.here.air, ...opts }) } : null), [data, opts])
  const scored = useMemo(() => {
    if (!data) return []
    return data.courses
      .map((c) => ({ ...c, score: computeWalkScore({ weather: c.weather, air: c.air, ...opts }) }))
      .sort((a, b) => b.score.total - a.score.total || (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
  }, [data, opts])

  const parks = useMemo(() => {
    if (!data?.parks) return []
    return data.parks
      .map((p) => ({ ...p, score: computeWalkScore({ weather: p.weather, air: p.air, ...opts }) }))
      .sort((a, b) => b.score.total - a.score.total || (b.areaM2 || 0) - (a.areaM2 || 0))
  }, [data, opts])
  const shown = scored.filter((c) => {
    if (filter === 'short') return (c.distanceKm ?? c.trackKm ?? 99) <= 15
    if (filter === 'easy') return c.level === 1
    if (filter === 'loop') return /^순환/.test(c.cycle || '')
    return true
  })
  const sidoInfo = SIDO_LIST.find((s) => s.short === sido)
  const nearby = data ? nearbyWithCourses(sido, data.counts) : []
  const pick = (s) => {
    saveSido(s)
    setSido(s)
  }
  const parkSection = parks.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">{sidoInfo?.full} 공원 산책지수</h2>
            <span className="count">큰 공원 {parks.length}곳</span>
          </div>
          <ol className="walk-list">
            {parks.slice(0, showAllParks ? parks.length : 9).map((p, i) => (
              <li key={p.id}>
                <Link to={`/walk/${sido}/${encodeURIComponent(p.id)}`} className="walk-row">
                  <span className="walk-row__rank" aria-label={`${i + 1}위`}>{i + 1}</span>
                  <ScoreTag score={p.score.total} tone={p.score.grade.tone} size={58} />
                  <div className="walk-row__body">
                    <strong className="walk-row__name">{p.name}</strong>
                    <span className="walk-row__meta">{p.sigungu} · {p.kind} · {fmtArea(p.areaM2)}</span>
                    <span className="walk-row__chips">
                      <span className="chip" style={{ '--chip': toneColor(p.score.grade.tone) }}>{p.score.grade.label}</span>
                      {p.weather?.t != null && <span className="chip chip--plain">{p.weather.t}°C</span>}
                      {p.air?.pm10 != null && <span className="chip chip--plain">미세 {pmGrade('pm10', p.air.pm10).label}</span>}
                    </span>
                  </div>
                  <span className="walk-row__go" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {!showAllParks && parks.length > 9 && (
            <button className="btn btn--ghost btn--block" onClick={() => setShowAllParks(true)}>공원 {parks.length - 9}곳 더 보기</button>
          )}
          <p className="fine">전국도시공원정보표준데이터의 근린·수변·체육·역사·문화·생태공원 중 면적이 큰 순서로 30곳을 골랐어요.</p>
        </section>
  )
  const w = here?.weather
  const a = here?.air

  return (
    <div className="page">
      <section className="hero hero--walk">
        <div className="hero__text">
          <h1 className="page-title">오늘, {sidoInfo?.full}<br />산책하기 어때요?</h1>
          <p className="lead">기상청 실시간 관측과 에어코리아 미세먼지를 합쳐 지금 산책하기 좋은 정도를 100점 만점으로 알려드려요.</p>
          <SidoPicker value={sido} onChange={(s) => { setSido(s); setShowAllParks(false) }} counts={data?.counts} />
        </div>
        <HeroDog />
      </section>

      {loading && <Loading text="지금 날씨와 미세먼지를 확인하고 있어요" />}
      {error && <ErrorBox error={error} />}

      {idx.data?.warnings?.items?.length > 0 && <WarningBanner warnings={idx.data.warnings} />}

      {here && (
        <>
          {!profile && (
            <div className="notice notice--prompt">
              <span>우리 강아지를 등록하면 견종·나이·털에 맞춘 산책지수를 보여드려요.</span>
              <Link className="btn btn--sm" to="/me?tab=dog">맞춤 지수 켜기</Link>
            </div>
          )}
          <Link to={`/walk/${sido}/here`} className="best">
            <div className="best__tag">
              <ScoreTag score={here.score.total} tone={here.score.grade.tone} size={112} label={here.score.grade.label} />
            </div>
            <div className="best__body">
              <p className="best__kicker">지금 {here.spot} 기준{profile ? ` · ${profile.name || '우리 아이'} 맞춤` : ''} 산책지수</p>
              <h2 className="best__name">{here.score.grade.label}</h2>
              <p className="best__note">{here.score.notes[0]}</p>
              <span className="best__more">시간대별 추천 보기</span>
            </div>
          </Link>

          <div className="conditions" aria-label={`${here.spot} 기상 정보`}>
            <Condition label="기온" value={w?.t != null ? `${w.t}°C` : '-'} />
            <Condition label="강수" value={PTY_LABEL[w?.pty ?? 0]} sub={w?.rn1 ? `${w.rn1}mm` : ''} />
            <Condition label="습도" value={w?.reh != null ? `${w.reh}%` : '-'} />
            <Condition label="바람" value={w?.wsd != null ? `${w.wsd}m/s` : '-'} />
            <Condition label="미세먼지" value={pmGrade('pm10', a?.pm10).label} sub={a?.pm10 != null ? `${a.pm10}㎍/㎥` : ''} />
            <Condition label="초미세먼지" value={pmGrade('pm25', a?.pm25).label} sub={a?.pm25 != null ? `${a.pm25}㎍/㎥` : ''} />
          </div>
          <div className="extras">
            <span className="chip chip--plain">자외선 {uv != null ? `${uv} · ${uvGrade(uv).label}` : '정보 없음'}</span>
            <span className="chip chip--plain">진드기 {here.score.tick?.level ? here.score.tick.label : '적음'}</span>
            {idx.data?.pollen?.inSeason && pollen != null && <span className="chip chip--plain">꽃가루 {POLLEN_LABEL[pollen]}</span>}
            <ShareButton
              data={{
                place: `${sidoInfo?.full} ${here.spot}`,
                score: here.score.total,
                grade: here.score.grade.label,
                toneColor: toneColor(here.score.grade.tone),
                note: here.score.notes[0],
                dogName: profile?.name,
                facts: [['기온', w?.t != null ? `${w.t}°C` : '-'], ['미세먼지', pmGrade('pm10', a?.pm10).label], ['바람', w?.wsd != null ? `${w.wsd}m/s` : '-'], ['자외선', uv != null ? uvGrade(uv).label : '-']],
              }}
            />
          </div>
          <p className="fine">
            관측 {w?.baseTime ? fmtBase(w.baseTime) : '-'} · 대기질 {a?.stationName ? `${a.stationName} 측정소` : '-'}{a?.dataTime ? ` (${a.dataTime})` : ''}
          </p>

          {scored.length === 0 && parkSection}

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">{sidoInfo?.full} 걷기길 산책지수</h2>
              {scored.length > 0 && <span className="count">{scored.length}개 코스</span>}
            </div>

            {scored.length === 0 ? (
              <div className="no-course">
                <p>
                  <strong>{sidoInfo?.full}에는 두루누비에 등록된 걷기길이 아직 없어요.</strong>
                  <br />위의 산책지수는 {here.spot} 기준이에요.{parks.length ? ' 공원별 산책지수도 함께 확인해 보세요.' : ''} 걷기길이 있는 가까운 지역도 살펴보세요.
                </p>
                <div className="actions">
                  {nearby.map((n) => (
                    <button key={n.short} className="btn btn--ghost btn--sm" onClick={() => pick(n.short)}>
                      {n.full} · {n.count}개
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="toolbar">
                  <Segmented options={FILTERS} value={filter} onChange={setFilter} label="코스 조건" />
                  <Segmented options={[{ value: 'list', label: '목록' }, { value: 'map', label: '지도' }]} value={view} onChange={setView} label="보기 방식" />
                </div>
                <ScoreLegend />

                {view === 'map' ? (
                  <MapView
                    className="map--tall"
                    label="걷기길 산책지수 지도"
                    center={data.center}
                    zoom={10}
                    fit={shown.filter((c) => c.start).map((c) => [c.start.lat, c.start.lng])}
                    markers={shown
                      .filter((c) => c.start)
                      .map((c) => ({
                        id: c.id,
                        lat: c.start.lat,
                        lng: c.start.lng,
                        icon: pinIcon({ text: c.score.total, color: toneColor(c.score.grade.tone) }),
                        popup: (
                          <div className="popup">
                            <strong>{c.name}</strong>
                            <span>{c.score.total}점 · {c.score.grade.label}</span>
                            <button className="link-btn" onClick={() => navigate(`/walk/${sido}/${c.id}`)}>상세 보기</button>
                          </div>
                        ),
                      }))}
                  />
                ) : (
                  <ol className="walk-list">
                    {shown.map((c, i) => (
                      <li key={c.id}>
                        <Link to={`/walk/${sido}/${c.id}`} className="walk-row">
                          <span className="walk-row__rank" aria-label={`${i + 1}위`}>{i + 1}</span>
                          <ScoreTag score={c.score.total} tone={c.score.grade.tone} size={58} />
                          <div className="walk-row__body">
                            <strong className="walk-row__name">{c.name}</strong>
                            <span className="walk-row__meta">
                              {c.sigun} · {fmtKm(c.distanceKm)} · {fmtMinutes(c.minutes)} · {LEVEL_LABEL[c.level] || '-'}
                            </span>
                            <span className="walk-row__chips">
                              <span className="chip" style={{ '--chip': toneColor(c.score.grade.tone) }}>{c.score.grade.label}</span>
                              {c.weather?.t != null && <span className="chip chip--plain">{c.weather.t}°C</span>}
                              {c.air?.pm10 != null && <span className="chip chip--plain">미세 {pmGrade('pm10', c.air.pm10).label}</span>}
                              {Number(c.weather?.pty) > 0 && <span className="chip chip--plain">{PTY_LABEL[c.weather.pty]}</span>}
                            </span>
                          </div>
                          <span className="walk-row__go" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {!shown.length && <li className="muted">조건에 맞는 코스가 없어요. 필터를 바꿔 보세요.</li>}
                  </ol>
                )}
                <p className="fine">
                  두루누비 걷기길은 7~26km 길이의 코리아둘레길 코스예요. 반려견과는 출발점 근처 1~3km 구간만 걸어도 충분해요.
                </p>
              </>
            )}
          </section>


          {scored.length > 0 && parkSection}

          <p className="fine">
            산책지수 = 기온(체감) 30 + 강수 25 + 미세먼지 25 + 바람 10 + 습도 10. 비·눈, 미세먼지 매우 나쁨, 폭염·한파일 때는 점수 상한이 적용돼요.
            걷기길마다 출발점이 속한 기상청 격자의 초단기실황과 가장 가까운 에어코리아 측정소 값을 사용합니다.
          </p>
        </>
      )}
    </div>
  )
}

function fmtBase(s) {
  const [d, t] = s.split(' ')
  return `${Number(d.slice(4, 6))}월 ${Number(d.slice(6, 8))}일 ${t.slice(0, 2)}:${t.slice(2)}`
}

function Condition({ label, value, sub }) {
  return (
    <div className="condition">
      <span className="condition__label">{label}</span>
      <strong className="condition__value">{value}</strong>
      {sub && <span className="condition__sub">{sub}</span>}
    </div>
  )
}

function ScoreLegend() {
  const items = [
    ['great', '85+ 최고'],
    ['good', '70+ 좋아요'],
    ['fair', '50+ 괜찮아요'],
    ['poor', '30+ 짧게만'],
    ['bad', '실내 놀이'],
  ]
  return (
    <ul className="legend" aria-label="산책지수 색상 기준">
      {items.map(([t, l]) => (
        <li key={t}>
          <span className="legend__dot" style={{ background: toneColor(t) }} />
          {l}
        </li>
      ))}
    </ul>
  )
}

function HeroDog() {
  // 리드줄을 문 골든 리트리버 일러스트 (장식)
  return (
    <svg className="hero__art" viewBox="0 0 220 170" aria-hidden="true">
      <ellipse cx="112" cy="156" rx="86" ry="9" fill="var(--track)" />
      <path d="M58 92c-8-26 10-50 44-52 30-2 52 12 62 34 8 18 4 40-4 54l-8 22h-12l-2-18c-14 6-34 6-50 2l-4 16H72l-4-20c-8-8-10-24-10-38z" fill="var(--golden)" />
      <path d="M150 120l10 30h-12l-6-24zM72 118l-6 32h12l6-26z" fill="var(--golden-deep)" />
      <path d="M160 96c14-4 28 4 34-6-2 14-18 22-34 18z" fill="var(--golden-deep)" />
      <path d="M44 58c0-22 18-36 38-34 18 2 30 16 28 36-2 18-18 30-36 30-18 0-30-14-30-32z" fill="var(--golden)" />
      <path d="M50 44c-12 2-18 22-12 36 10-2 16-14 18-26zM96 34c10 6 14 24 6 36-8-6-10-20-10-32z" fill="var(--golden-deep)" />
      <circle cx="64" cy="56" r="4" fill="var(--ink)" />
      <circle cx="86" cy="54" r="4" fill="var(--ink)" />
      <circle cx="65.5" cy="54.5" r="1.2" fill="#fff" />
      <circle cx="87.5" cy="52.5" r="1.2" fill="#fff" />
      <ellipse cx="74" cy="68" rx="7" ry="5" fill="var(--ink)" />
      <path d="M68 76q6 8 12 0" stroke="var(--ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M71 78q3 10 8 2" fill="#E57E73" />
      <path d="M60 86c10 6 26 6 36-2" stroke="var(--leaf)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M96 84c22 4 44-20 62-42 6-8 14-12 22-10" stroke="var(--leaf)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="182" cy="32" r="7" fill="none" stroke="var(--leaf)" strokeWidth="3" />
    </svg>
  )
}
