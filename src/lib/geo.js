export const SIDO_LIST = [
  { short: '서울', full: '서울특별시', spot: '서울시청', center: [37.5663, 126.9779] },
  { short: '부산', full: '부산광역시', spot: '부산시청', center: [35.1798, 129.075] },
  { short: '대구', full: '대구광역시', spot: '대구시청', center: [35.8714, 128.6014] },
  { short: '인천', full: '인천광역시', spot: '인천시청', center: [37.4563, 126.7052] },
  { short: '대전', full: '대전광역시', spot: '대전시청', center: [36.3504, 127.3845] },
  { short: '울산', full: '울산광역시', spot: '울산시청', center: [35.5396, 129.3115] },
  { short: '세종', full: '세종특별자치시', spot: '세종시청', center: [36.48, 127.289] },
  { short: '경기', full: '경기도', spot: '수원시(경기도청)', center: [37.2893, 127.0535] },
  { short: '강원', full: '강원특별자치도', spot: '춘천시(강원도청)', center: [37.8853, 127.7298] },
  { short: '충북', full: '충청북도', spot: '청주시(충북도청)', center: [36.6358, 127.4913] },
  { short: '충남', full: '충청남도', spot: '홍성군(충남도청)', center: [36.6588, 126.6728] },
  { short: '전북', full: '전북특별자치도', spot: '전주시(전북도청)', center: [35.8205, 127.1088] },
  { short: '전남광주', full: '전남광주통합특별시', spot: '광주시청 일대', center: [35.1601, 126.8514], aliases: ['광주광역시', '전라남도', '전남 ', '광주 '] },
  { short: '경북', full: '경상북도', spot: '안동시(경북도청)', center: [36.5759, 128.5056] },
  { short: '경남', full: '경상남도', spot: '창원시(경남도청)', center: [35.2383, 128.6925] },
  { short: '제주', full: '제주특별자치도', spot: '제주시(제주도청)', center: [33.489, 126.4983] },
]

export function sidoOf(text) {
  const t = (text || '').trim()
  for (const s of SIDO_LIST) if (t.startsWith(s.full) || t.startsWith(s.short + ' ') || s.aliases?.some((a) => t.startsWith(a))) return s.short
  return null
}

// 걷기길이 있는 가까운 지역 (가까운 순)
export function nearbyWithCourses(sido, counts, n = 3) {
  const here = SIDO_LIST.find((s) => s.short === sido)
  if (!here || !counts) return []
  return SIDO_LIST.filter((s) => s.short !== sido && counts[s.short] > 0)
    .map((s) => ({ ...s, count: counts[s.short], d: distanceKm({ lat: here.center[0], lng: here.center[1] }, { lat: s.center[0], lng: s.center[1] }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
}

export function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function nearestSido(lat, lng) {
  return SIDO_LIST.map((s) => ({ s, d: distanceKm({ lat, lng }, { lat: s.center[0], lng: s.center[1] }) })).sort((a, b) => a.d - b.d)[0].s.short
}

export function fmtKm(km) {
  if (km == null) return '-'
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`
}

export function fmtMinutes(min) {
  if (!min) return '-'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`
}

export function fmtDate(ymd) {
  if (!ymd || ymd.length < 8) return ymd || '-'
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저는 위치 확인을 지원하지 않습니다.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.' : '현재 위치를 확인하지 못했습니다.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  })
}

export const LEVEL_LABEL = { 1: '쉬움', 2: '보통', 3: '어려움' }

export function fmtArea(m2) {
  if (!m2) return '-'
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(1)}㎢`
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(1)}만㎡`
  return `${Math.round(m2).toLocaleString()}㎡`
}

// 원형이라 가정했을 때 공원 한 바퀴 길이 (대략)
export function parkLoopKm(m2) {
  if (!m2) return null
  return (2 * Math.PI * Math.sqrt(m2 / Math.PI)) / 1000
}
