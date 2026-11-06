// 행정안전부 동물병원 인허가 데이터 (veter.csv, CP949 인코딩) 로더
import fs from 'node:fs'
import path from 'node:path'
import proj4 from 'proj4'

// 지방행정 인허가 데이터 좌표계: EPSG:5174 (Korean 1985 / Modified Central Belt)
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43')

// 따옴표/줄바꿈을 지원하는 CSV 파서
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || r[0])
}

export function formatTel(raw) {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (/^1[5-9]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`
  if (d.startsWith('02')) {
    const rest = d.slice(2)
    return rest.length === 8 ? `02-${rest.slice(0, 4)}-${rest.slice(4)}` : rest.length === 7 ? `02-${rest.slice(0, 3)}-${rest.slice(3)}` : d
  }
  if (/^0(50\d|70)/.test(d) && d.length >= 11) {
    const p = d.startsWith('070') ? 3 : 4
    const rest = d.slice(p)
    return `${d.slice(0, p)}-${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
  }
  if (d.startsWith('0') && (d.length === 10 || d.length === 11)) {
    const rest = d.slice(3)
    return `${d.slice(0, 3)}-${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
  }
  return raw.trim()
}

// 지방행정 인허가 CSV (공통 형식) — 프로젝트 루트에 두면 자동으로 사용
export const PLACE_TYPES = {
  hospital: { file: 'veter.csv', label: '동물병원' },
  pharmacy: { file: 'animal_pharmacy.csv', label: '동물약국' },
  grooming: { file: 'animal_grooming.csv', label: '동물미용' },
  care: { file: 'animal_care.csv', label: '위탁관리(호텔·유치원)' },
}
const caches = new Map()

export function availablePlaceTypes() {
  return Object.entries(PLACE_TYPES)
    .filter(([, t]) => fs.existsSync(path.resolve(process.cwd(), t.file)))
    .map(([id, t]) => ({ id, label: t.label, file: t.file }))
}

export function loadPlaces(type, sidoOf) {
  const t = PLACE_TYPES[type]
  if (!t) throw new Error('알 수 없는 종류입니다.')
  const file = path.resolve(process.cwd(), t.file)
  const stat = fs.statSync(file) // 파일이 없으면 예외
  const hit = caches.get(type)
  if (hit && hit.mtime === stat.mtimeMs) return hit
  const buf = fs.readFileSync(file)
  // BOM 이 있으면 UTF-8, 아니면 공공데이터 기본 인코딩(CP949)으로 읽는다
  const isUtf8 = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
  const text = new TextDecoder(isUtf8 ? 'utf-8' : 'euc-kr').decode(buf)
  const [head, ...rows] = parseCsv(text)
  const col = (name) => head.findIndex((h) => h.trim() === name)
  const C = {
    id: col('관리번호'), name: col('사업장명'), stateCode: col('영업상태코드'), state: col('영업상태명'),
    detail: col('상세영업상태명'), road: col('도로명주소'), lot: col('지번주소'), tel: col('전화번호'),
    x: col('좌표정보(X)'), y: col('좌표정보(Y)'), since: col('인허가일자'), area: col('소재지면적'), updated: col('데이터갱신시점'),
  }

  const seen = new Set()
  const data = []
  for (const r of rows) {
    const get = (i) => (i >= 0 ? (r[i] || '').trim() : '')
    const open = get(C.stateCode) === '01' || /영업|정상/.test(get(C.state))
    if (!open) continue
    const name = get(C.name)
    const addr = get(C.road) || get(C.lot)
    if (!name) continue
    const key = `${name}|${addr}`
    if (seen.has(key)) continue // 같은 병원이 중복 등록된 경우
    seen.add(key)

    let lat = null, lng = null
    const x = Number(get(C.x)), y = Number(get(C.y))
    if (x && y) {
      const [lo, la] = proj4('EPSG:5174', 'WGS84', [x, y])
      if (la > 32.5 && la < 39 && lo > 124 && lo < 132) {
        lat = +la.toFixed(6)
        lng = +lo.toFixed(6)
      }
    }
    const tokens = addr.split(/\s+/)
    data.push({
      id: get(C.id) || key,
      name,
      addr,
      roadAddr: get(C.road),
      lotAddr: get(C.lot),
      tel: formatTel(get(C.tel)),
      since: get(C.since),
      area: Number(get(C.area)) || null,
      lat,
      lng,
      sido: sidoOf(addr),
      // 시군구: '경기도 수원시 장안구' 처럼 구가 있는 시는 '수원시 장안구'로 묶음
      sigungu: /시$/.test(tokens[1] || '') && /구$/.test(tokens[2] || '') ? `${tokens[1]} ${tokens[2]}` : tokens[1] || '',
    })
  }
  const entry = { mtime: stat.mtimeMs, data, updated: rows.length ? (rows[0][C.updated] || '').slice(0, 10) : '' }
  caches.set(type, entry)
  return entry
}

export function loadHospitals(sidoOf) {
  return loadPlaces('hospital', sidoOf).data
}
export function hospitalsUpdated() {
  return caches.get('hospital')?.updated || ''
}
