import { useMemo, useState } from 'react'
import { useApi } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { distanceKm, fmtKm, getPosition, SIDO_LIST } from '../lib/geo.js'
import { placeTags, TAG_FILTERS_BY_TYPE } from '../lib/hospitalTags.js'
import { Loading, ErrorBox, Segmented, Empty } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { pinIcon, loadSido, saveSido } from '../lib/ui-helpers.js'

const PIN = { hospital: '+', pharmacy: '약', grooming: '미', care: '집' }
const PIN_COLOR = { hospital: 'var(--golden-deep)', pharmacy: '#6A6FB0', grooming: '#B5658A', care: 'var(--leaf)' }
const RADII = [1, 3, 5, 10].map((r) => ({ value: r, label: `${r}km` }))
const PAGE = 30

export default function Hospitals() {
  const [type, setType] = useState('hospital')
  const types = useApi('/api/places/types')
  const typeLabel = types.data?.find((t) => t.id === type)?.label || '동물병원'
  const isHospital = type === 'hospital'
  usePageMeta({ title: '내 주변 동물병원·반려생활 찾기', description: '현재 위치나 지역별로 영업 중인 동물병원을 찾고, 24시·고양이·특수동물 등 특징과 전화번호, 길찾기를 확인하세요.' })
  const [mode, setMode] = useState('region')
  const [pos, setPos] = useState(null)
  const [posMsg, setPosMsg] = useState('')
  const [locating, setLocating] = useState(false)
  const [radius, setRadius] = useState(3)
  const [sido, setSido] = useState(() => loadSido())
  const [sigungu, setSigungu] = useState('')
  const [tags, setTags] = useState([])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState(null)
  // 내 주변: 반경 10km 를 한 번에 받아 두고 화면에서 1·3·5·10km 로 거름 (위치는 약 100m 단위로 반올림해 캐시 활용)
  const placesPath = mode === 'near' && pos
    ? `/api/places?type=${type}&lat=${pos.lat.toFixed(3)}&lng=${pos.lng.toFixed(3)}&radius=10`
    : mode === 'near' ? null : `/api/places?type=${type}&sido=${encodeURIComponent(sido)}`
  const { data, meta, error, loading } = useApi(placesPath)

  const all = useMemo(() => (data || []).map((h) => ({ ...h, tags: placeTags(type, h.name) })), [data, type])
  const sigunguList = useMemo(() => [...new Set(all.filter((h) => h.sido === sido).map((h) => h.sigungu).filter(Boolean))].sort(), [all, sido])

  const list = useMemo(() => {
    let l = all
    if (mode === 'near') {
      if (!pos) return []
      l = l.filter((h) => h.lat).map((h) => ({ ...h, dist: distanceKm(pos, h) })).filter((h) => h.dist <= radius).sort((a, b) => a.dist - b.dist)
    } else {
      l = l.filter((h) => h.sido === sido && (!sigungu || h.sigungu === sigungu))
      if (pos) l = l.map((h) => ({ ...h, dist: h.lat ? distanceKm(pos, h) : null }))
      l = [...l].sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9) || a.name.localeCompare(b.name, 'ko'))
    }
    if (tags.length) l = l.filter((h) => tags.every((t) => h.tags.includes(t)))
    const kw = q.trim()
    if (kw) l = l.filter((h) => h.name.includes(kw) || h.addr.includes(kw))
    return l
  }, [all, mode, pos, radius, sido, sigungu, tags, q])

  const locate = async () => {
    setLocating(true)
    setPosMsg('')
    try {
      const p = await getPosition()
      setPos(p)
      setMode('near')
      setLimit(PAGE)
    } catch (e) {
      setPosMsg(e.message)
    } finally {
      setLocating(false)
    }
  }

  const toggleTag = (t) => {
    setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
    setLimit(PAGE)
  }
  const visible = list.slice(0, limit)
  const onMap = visible.filter((h) => h.lat)
  const sel = selected && list.find((h) => h.id === selected)

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{typeLabel} 찾기</h1>
        <p className="lead">지금 내 주변이나 원하는 지역의 영업 중인 {typeLabel}을 찾아보세요.</p>
        {types.data?.length > 1 && (
          <Segmented
            options={types.data.map((t) => ({ value: t.id, label: t.label }))}
            value={type}
            onChange={(v) => { setType(v); setTags([]); setSelected(null); setLimit(PAGE) }}
            label="찾을 곳 종류"
          />
        )}
      </header>

      <div className="filters">
        <Segmented
          options={[{ value: 'near', label: '내 주변' }, { value: 'region', label: '지역별' }]}
          value={mode}
          onChange={(m) => {
            if (m === 'near' && !pos) locate()
            else setMode(m)
            setLimit(PAGE)
          }}
          label="찾는 방식"
        />
        {mode === 'near' ? (
          <>
            <Segmented options={RADII} value={radius} onChange={(r) => { setRadius(r); setLimit(PAGE) }} label="반경" />
            <button className="btn btn--ghost btn--sm" onClick={locate} disabled={locating}>{locating ? '위치 확인 중…' : '위치 새로고침'}</button>
          </>
        ) : (
          <>
            <label className="field field--inline" htmlFor="h-sido">
              <span className="field__label">시도</span>
              <select id="h-sido" value={sido} onChange={(e) => { setSido(e.target.value); saveSido(e.target.value); setSigungu(''); setLimit(PAGE) }}>
                {SIDO_LIST.map((s) => <option key={s.short} value={s.short}>{s.full}</option>)}
              </select>
            </label>
            <label className="field field--inline" htmlFor="h-sgg">
              <span className="field__label">시군구</span>
              <select id="h-sgg" value={sigungu} onChange={(e) => { setSigungu(e.target.value); setLimit(PAGE) }}>
                <option value="">전체</option>
                {sigunguList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="field field--grow" htmlFor="h-q">
          <span className="field__label">검색</span>
          <input id="h-q" type="search" placeholder="이름이나 주소" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} />
        </label>
      </div>
      {posMsg && <p className="hint hint--error">{posMsg}</p>}

      {(
      <div className="tag-filter" role="group" aria-label={`${typeLabel} 특징 필터`}>
        {(TAG_FILTERS_BY_TYPE[type] || []).map((t) => (
          <button key={t} type="button" className={`tag-toggle${tags.includes(t) ? ' is-on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
            {t}
          </button>
        ))}
      </div>
      )}
      {loading && <Loading text={`전국 ${typeLabel} 정보를 불러오고 있어요`} />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="split">
          <div className="split__map">
            <MapView
              className="map--sticky"
              label={`${typeLabel} 지도`}
              center={pos ? [pos.lat, pos.lng] : SIDO_LIST.find((s) => s.short === sido)?.center}
              zoom={12}
              fit={sel ? [] : [...onMap.map((h) => [h.lat, h.lng]), ...(pos && mode === 'near' ? [[pos.lat, pos.lng]] : [])]}
              flyTo={sel?.lat ? [sel.lat, sel.lng] : null}
              circle={pos && mode === 'near' ? { center: [pos.lat, pos.lng], radius: radius * 1000 } : null}
              markers={[
                ...(pos ? [{ id: 'me', lat: pos.lat, lng: pos.lng, icon: pinIcon({ kind: 'dot', color: '#3E7CB1', active: true }), z: 50, popup: '내 위치' }] : []),
                ...onMap.map((h) => ({
                  id: h.id,
                  lat: h.lat,
                  lng: h.lng,
                  icon: pinIcon({ text: PIN[type] || '+', color: h.tags.some((t) => t.startsWith('24시')) ? 'var(--score-bad)' : PIN_COLOR[type] || 'var(--golden-deep)', active: h.id === selected }),
                  z: h.id === selected ? 40 : 0,
                  onClick: () => setSelected(h.id),
                  popup: (
                    <div className="popup">
                      <strong>{h.name}</strong>
                      <span>{h.addr}</span>
                      {h.tel && <a href={`tel:${h.tel}`}>{h.tel}</a>}
                    </div>
                  ),
                })),
              ]}
            />
            <ul className="legend">
              <li><span className="legend__dot" style={{ background: PIN_COLOR[type] || 'var(--golden-deep)' }} />{typeLabel}</li>
              {(type === 'hospital' || type === 'pharmacy') && <li><span className="legend__dot" style={{ background: 'var(--score-bad)' }} />24시</li>}
              {pos && <li><span className="legend__dot" style={{ background: '#3E7CB1' }} />내 위치</li>}
            </ul>
          </div>

          <div className="split__list">
            <p className="count">
              {mode === 'near' ? `반경 ${radius}km 안에 ` : ''}{list.length}곳
            </p>
            {!list.length && (
              <Empty title={mode === 'near' ? '가까운 병원이 없어요' : '조건에 맞는 병원이 없어요'}>
                {mode === 'near' ? '반경을 넓혀 보세요.' : '필터를 줄이거나 다른 지역을 골라 보세요.'}
              </Empty>
            )}
            <ul className="hosp-list">
              {visible.map((h) => (
                <li key={h.id} className={`hosp${h.id === selected ? ' is-selected' : ''}`}>
                  <button className="hosp__main" onClick={() => setSelected(h.id)} aria-label={`${h.name} 지도에서 보기`}>
                    <span className="hosp__name">{h.name}</span>
                    {h.dist != null && <span className="hosp__dist">{fmtKm(h.dist)}</span>}
                  </button>
                  <p className="hosp__addr">{h.addr || '주소 정보 없음'}</p>
                  {h.tags.length > 0 && (
                    <div className="hosp__tags">
                      {h.tags.map((t) => <span key={t} className={`chip ${t === '24시·응급' ? 'chip--alert' : 'chip--plain'}`}>{t}</span>)}
                    </div>
                  )}
                  <div className="hosp__actions">
                    {h.tel ? <a className="btn btn--sm" href={`tel:${h.tel.replace(/[^\d]/g, '')}`}>전화 {h.tel}</a> : <span className="muted">전화번호 없음</span>}
                    {h.lat && (
                      <a className="btn btn--ghost btn--sm" href={`https://map.kakao.com/link/to/${encodeURIComponent(h.name)},${h.lat},${h.lng}`} target="_blank" rel="noreferrer">길찾기</a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {list.length > limit && (
              <button className="btn btn--ghost btn--block" onClick={() => setLimit((l) => l + PAGE)}>더 보기 ({list.length - limit}곳 남음)</button>
            )}
            <p className="fine">
              {isHospital ? '진료 특징 태그는 병원 이름에 들어 있는 단어(24시, 고양이, 특수동물, 치과 등)로 추정한 거예요. 실제 진료 과목과 진료 시간은 방문 전에 전화로 확인해 주세요.' : type === 'pharmacy' ? '동물약국 인허가에는 동물용 의약품을 함께 파는 일반 약국도 포함돼요. 이름에 동물·펫이 들어간 곳은 "동물 전문 약국"으로 표시했어요. 원하는 약이 있는지 전화로 먼저 확인해 주세요.' : '특징 태그는 업체 이름에 들어 있는 단어로 추정한 거예요. 영업시간과 예약 가능 여부는 방문 전에 전화로 확인해 주세요.'}
              데이터: 행정안전부 {typeLabel} 인허가 정보{meta?.updated ? ` (${meta.updated} 기준)` : ''}, 영업 중인 곳만 표시.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
