import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { fmtKm, fmtMinutes, LEVEL_LABEL, SIDO_LIST, nearbyWithCourses } from '../lib/geo.js'
import { Loading, ErrorBox, Segmented, Empty } from '../components/ui.jsx'
import SidoPicker from '../components/SidoPicker.jsx'
import MapView from '../components/MapView.jsx'
import PetNearby from '../components/PetNearby.jsx'
import ParksView from '../components/ParksView.jsx'
import { pinIcon, loadSido, saveSido, levelColor } from '../lib/ui-helpers.js'

const LEVELS = [
  { value: 0, label: '전체' },
  { value: 1, label: '쉬움' },
  { value: 2, label: '보통' },
  { value: 3, label: '어려움' },
]
const DIST = [
  { value: 'all', label: '전체 거리' },
  { value: '0-12', label: '12km 이하' },
  { value: '12-16', label: '12~16km' },
  { value: '16-20', label: '16~20km' },
  { value: '20-999', label: '20km 이상' },
]
const PAGE = 20

export default function Trails() {
  const [sido, setSido] = useState(() => loadSido('서울'))
  const [mode, setMode] = useState('trail')
  const [level, setLevel] = useState(0)
  const [dist, setDist] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [focus, setFocus] = useState(null)
  const navigate = useNavigate()
  usePageMeta({ title: '산책로 정보', description: '전국 걷기길 코스의 출발·도착 지점과 실제 경로, 거리·소요시간·난이도, 동네 공원과 반려견 동반 가능 장소를 지도에서 확인하세요.' })
  const { data, meta, error, loading } = useApi(mode === 'trail' ? `/api/trails?sido=${encodeURIComponent(sido)}` : null)

  const list = useMemo(() => {
    if (!data) return []
    const [lo, hi] = dist === 'all' ? [0, Infinity] : dist.split('-').map(Number)
    const kw = q.trim()
    return data
      .filter((c) => !level || c.level === level)
      .filter((c) => {
        const km = c.distanceKm ?? c.trackKm
        return dist === 'all' || (km != null && km >= lo && km < hi)
      })
      .filter((c) => !kw || c.name.includes(kw) || c.sigun.includes(kw) || (c.theme?.name || '').includes(kw))
      .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
  }, [data, level, dist, q])

  const center = SIDO_LIST.find((s) => s.short === sido)?.center
  const mapped = list.filter((c) => c.start)
  const resetLimit = (fn) => (v) => {
    fn(v)
    setLimit(PAGE)
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">산책로 정보</h1>
        <p className="lead">걷기길의 출발·도착 지점과 실제 경로, 동네 공원, 반려견과 함께 갈 수 있는 곳을 지도에서 확인하세요.</p>
      </header>

      <Segmented
        options={[{ value: 'trail', label: '걷기길' }, { value: 'park', label: '도시공원' }, { value: 'pet', label: '반려견 동반 장소' }]}
        value={mode}
        onChange={setMode}
        label="정보 종류"
      />

      {mode !== 'trail' && (
        <div className="filters">
          <SidoPicker value={sido} onChange={setSido} id="place-sido" />
        </div>
      )}
      {mode === 'park' && <ParksView sido={sido} />}
      {mode === 'pet' && center && (
        <PetNearby key={sido} lat={center[0]} lng={center[1]} radius={20000} limit={40} showError withMap title={`${SIDO_LIST.find((s) => s.short === sido)?.spot} 반경 20km 반려견 동반 장소`} />
      )}

      {mode === 'trail' && (
      <>

      <div className="filters">
        <SidoPicker value={sido} onChange={resetLimit(setSido)} counts={meta?.counts} id="trail-sido" />
        <label className="field field--grow" htmlFor="trail-q">
          <span className="field__label">검색</span>
          <input id="trail-q" type="search" placeholder="길 이름, 시군구, 테마" value={q} onChange={(e) => resetLimit(setQ)(e.target.value)} />
        </label>
        <Segmented options={LEVELS} value={level} onChange={resetLimit(setLevel)} label="난이도" />
        <Segmented options={DIST} value={dist} onChange={resetLimit(setDist)} label="거리" wrap />
      </div>
      {loading && <Loading text="걷기길 경로를 모으고 있어요" />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="split">
          <div className="split__map">
            <MapView
              className="map--sticky"
              label="산책로 위치 지도"
              center={center}
              zoom={10}
              flyTo={focus}
              fit={mapped.map((c) => [c.start.lat, c.start.lng])}
              markers={mapped.map((c) => ({
                id: c.id,
                lat: c.start.lat,
                lng: c.start.lng,
                icon: pinIcon({ kind: 'dot', color: levelColor(c.level), active: focus && focus[0] === c.start.lat && focus[1] === c.start.lng }),
                popup: (
                  <div className="popup">
                    <strong>{c.name}</strong>
                    <span>{fmtKm(c.distanceKm)} · {fmtMinutes(c.minutes)} · {LEVEL_LABEL[c.level] || '-'}</span>
                    <button className="link-btn" onClick={() => navigate(`/trails/${c.id}`)}>경로 보기</button>
                  </div>
                ),
              }))}
            />
            <ul className="legend">
              {[1, 2, 3].map((l) => (
                <li key={l}><span className="legend__dot" style={{ background: levelColor(l) }} />{LEVEL_LABEL[l]}</li>
              ))}
              <li className="muted">점은 출발 지점이에요</li>
            </ul>
          </div>

          <div className="split__list">
            <p className="count">{list.length}개의 길</p>
            {!list.length && !data.length && (
              <div className="no-course">
                <p>
                  <strong>{SIDO_LIST.find((s) => s.short === sido)?.full}에는 두루누비에 등록된 걷기길이 아직 없어요.</strong>
                  <br />걷기길이 있는 가까운 지역을 골라 보세요.
                </p>
                <div className="actions">
                  {nearbyWithCourses(sido, meta?.counts).map((n) => (
                    <button key={n.short} className="btn btn--ghost btn--sm" onClick={() => { saveSido(n.short); resetLimit(setSido)(n.short) }}>
                      {n.full} · {n.count}개
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!list.length && data.length > 0 && <Empty title="조건에 맞는 길이 없어요">필터를 바꿔 보세요.</Empty>}
            <ul className="trail-list">
              {list.slice(0, limit).map((c) => (
                <li key={c.id} className="trail-card">
                  <Link to={`/trails/${c.id}`} className="trail-card__link">
                    <div className="trail-card__top">
                      <span className="level" style={{ '--lv': levelColor(c.level) }}>{LEVEL_LABEL[c.level] || '정보 없음'}</span>
                      {c.cycle && <span className="chip chip--plain">{c.cycle}</span>}
                    </div>
                    <strong className="trail-card__name">{c.name}</strong>
                    <span className="trail-card__meta">{c.sigun}{c.theme?.name ? ` · ${c.theme.name}` : ''}</span>
                    <dl className="mini-stats">
                      <div><dt>거리</dt><dd>{fmtKm(c.distanceKm ?? c.trackKm)}</dd></div>
                      <div><dt>소요</dt><dd>{fmtMinutes(c.minutes)}</dd></div>
                    </dl>
                    {c.summary && <p className="trail-card__summary">{c.summary}</p>}
                  </Link>
                  {c.start && (
                    <button className="link-btn trail-card__locate" onClick={() => setFocus([c.start.lat, c.start.lng])}>
                      지도에서 보기
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {list.length > limit && (
              <button className="btn btn--ghost btn--block" onClick={() => setLimit((l) => l + PAGE)}>
                더 보기 ({list.length - limit}개 남음)
              </button>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

