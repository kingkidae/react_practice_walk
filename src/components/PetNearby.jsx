import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { fmtKm } from '../lib/geo.js'
import { Loading, ErrorBox, Empty } from './ui.jsx'
import MapView from './MapView.jsx'
import { pinIcon } from '../lib/ui-helpers.js'

/** 한국관광공사 반려동물 동반여행 API — 주변 반려견 동반 가능 장소 */
export default function PetNearby({ lat, lng, radius = 5000, limit = 8, title = '근처 반려견 동반 가능 장소', showError = false, withMap = false }) {
  const { data, error, loading } = useApi(`/api/pet/nearby?lat=${lat}&lng=${lng}&radius=${radius}`)
  const [open, setOpen] = useState(null)
  // API 승인 전이거나 오류면 섹션을 숨긴다
  if (error) return showError ? <ErrorBox error={error} /> : null
  if (loading) return <section className="panel"><h2 className="panel__title">{title}</h2><Loading text="반려견과 갈 수 있는 곳을 찾고 있어요" /></section>
  if (!data?.length) return showError ? <Empty title="주변에 등록된 반려견 동반 장소가 없어요" /> : null
  return (
    <section className="panel">
      <h2 className="panel__title">{title}</h2>
      {withMap && (
        <MapView
          className="map--mid"
          label="반려견 동반 장소 지도"
          center={[lat, lng]}
          zoom={11}
          fit={data.slice(0, limit).filter((p) => p.lat).map((p) => [p.lat, p.lng])}
          markers={data.slice(0, limit).filter((p) => p.lat).map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            icon: pinIcon({ kind: 'dot', color: open === p.id ? 'var(--score-bad)' : 'var(--golden-deep)', active: open === p.id }),
            onClick: () => setOpen(p.id),
            popup: <div className="popup"><strong>{p.title}</strong><span>{p.type} · {p.addr}</span></div>,
          }))}
        />
      )}
      <ul className="pet-list">
        {data.slice(0, limit).map((p) => (
          <li key={p.id} className="pet">
            <button className="pet__main" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              {p.image ? <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pet__noimg" aria-hidden="true" />}
              <span className="pet__text">
                <strong>{p.title}</strong>
                <span className="muted">{p.type}{p.distM != null ? ` · ${fmtKm(p.distM / 1000)}` : ''}</span>
                <span className="muted pet__addr">{p.addr}</span>
              </span>
            </button>
            {open === p.id && <PetDetail place={p} />}
          </li>
        ))}
      </ul>
      <p className="fine">출처: 한국관광공사 반려동물 동반여행 서비스. 동반 조건은 바뀔 수 있으니 방문 전에 확인해 주세요.</p>
    </section>
  )
}

function PetDetail({ place }) {
  const { data, loading } = useApi(`/api/pet/detail?id=${encodeURIComponent(place.id)}`)
  if (loading) return <p className="muted pet__detail">불러오는 중…</p>
  return (
    <dl className="pet__detail">
      {data?.type && <><dt>동반 구분</dt><dd>{data.type}</dd></>}
      {data?.allowed && <><dt>동반 가능</dt><dd>{data.allowed}</dd></>}
      {data?.need && <><dt>준비할 것</dt><dd>{data.need}</dd></>}
      {data?.facility && <><dt>편의 시설</dt><dd>{data.facility}</dd></>}
      {data?.etc && <><dt>안내</dt><dd className="pre">{data.etc}</dd></>}
      {data?.risk && <><dt>안전 주의</dt><dd className="pre">{data.risk}</dd></>}
      <dt>연락처</dt>
      <dd>
        {place.tel ? <a href={`tel:${place.tel.replace(/[^\d]/g, '')}`}>{place.tel}</a> : '정보 없음'}
        {place.lat && (
          <>
            {' · '}
            <a href={`https://map.kakao.com/link/to/${encodeURIComponent(place.title)},${place.lat},${place.lng}`} target="_blank" rel="noreferrer">길찾기</a>
          </>
        )}
      </dd>
    </dl>
  )
}
