// 공공데이터포털 API 중계 미들웨어 (Vite dev/preview 서버에서 동작)
// - 브라우저에 API 키를 노출하지 않고, CORS 문제를 피하며, 응답을 메모리에 캐시한다.
import fs from 'node:fs'
import path from 'node:path'
import { loadHospitals, parseCsv, loadPlaces, availablePlaceTypes } from './hospitals.js'

const BASE = 'https://apis.data.go.kr'

export const APIS = {
  weather: { name: '기상청_단기예보 조회서비스', url: 'https://www.data.go.kr/data/15084084/openapi.do' },
  air: { name: '한국환경공단_에어코리아_대기오염정보', url: 'https://www.data.go.kr/data/15073861/openapi.do' },
  station: { name: '한국환경공단_에어코리아_측정소정보', url: 'https://www.data.go.kr/data/15073877/openapi.do' },
  durunubi: { name: '한국관광공사_두루누비 정보 서비스', url: 'https://www.data.go.kr/data/15101974/openapi.do' },
  adopt: { name: '농림축산검역본부_구조동물 조회 서비스', url: 'https://www.data.go.kr/data/15098931/openapi.do' },
  living: { name: '기상청_생활기상지수 조회서비스(자외선)', url: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EA%B8%B0%EC%83%81%EC%B2%AD%20%EC%83%9D%ED%99%9C%EA%B8%B0%EC%83%81%EC%A7%80%EC%88%98' },
  health: { name: '기상청_보건기상지수 조회서비스(꽃가루)', url: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EA%B8%B0%EC%83%81%EC%B2%AD%20%EB%B3%B4%EA%B1%B4%EA%B8%B0%EC%83%81%EC%A7%80%EC%88%98' },
  warning: { name: '기상청_기상특보 조회서비스', url: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EA%B8%B0%EC%83%81%EC%B2%AD%20%EA%B8%B0%EC%83%81%ED%8A%B9%EB%B3%B4%20%EC%A1%B0%ED%9A%8C%EC%84%9C%EB%B9%84%EC%8A%A4' },
  pettour: { name: '한국관광공사_반려동물 동반여행 서비스', url: 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EB%B0%98%EB%A0%A4%EB%8F%99%EB%AC%BC%20%EB%8F%99%EB%B0%98%EC%97%AC%ED%96%89' },
}

// ---------- 공통 유틸 ----------
const cache = new Map()
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.promise
  const promise = fn()
  cache.set(key, { exp: Date.now() + ttlMs, promise })
  promise.catch(() => cache.delete(key))
  return promise
}

class ApiError extends Error {
  constructor(code, message, api) {
    super(message)
    this.code = code
    this.api = api
  }
}

function kstNow() {
  return new Date(Date.now() + 9 * 3600e3) // getUTC* 로 읽으면 한국시간
}
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

// 배포 사이트(HTTPS)에서 http 이미지가 막히지 않도록 https 로 바꾼다 (두 이미지 서버 모두 https 지원)
const https = (u) => (typeof u === 'string' ? u.replace(/^http:\/\//i, 'https://') : u)

function asArray(x) {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}

async function callDataGo(apiId, path, params, key) {
  if (!key) throw new ApiError('NO_KEY', '.env 에 VITE_API_KEY 가 없습니다.', apiId)
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}?serviceKey=${encodeURIComponent(key)}&${qs}`
  let text
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    text = await res.text()
  } catch (e) {
    throw new ApiError('NETWORK', `공공데이터포털에 연결하지 못했습니다 (${e.message})`, apiId)
  }
  // 게이트웨이 오류 (XML 또는 JSON)
  const gw = text.match(/<returnReasonCode>(\d+)<\/returnReasonCode>/) || text.match(/"returnReasonCode"\s*:\s*"?(\d+)/)
  if (gw) {
    const code = gw[1]
    if (['20', '30', '31', '32'].includes(code)) throw new ApiError('KEY_NOT_REGISTERED', '이 API의 활용신청 승인이 필요합니다.', apiId)
    if (code === '22') throw new ApiError('RATE_LIMIT', '오늘 호출 한도를 초과했습니다. 내일 다시 시도해 주세요.', apiId)
    throw new ApiError('GATEWAY_' + code, `공공데이터포털 오류 (코드 ${code})`, apiId)
  }
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new ApiError('BAD_RESPONSE', 'API 응답을 해석하지 못했습니다.', apiId)
  }
  const header = json?.response?.header
  // 성공 코드: '00', '0000' / 데이터 없음: '03'
  if (header?.resultCode && !/^0+$/.test(String(header.resultCode)) && String(header.resultCode) !== '03') {
    throw new ApiError('RESULT_' + header.resultCode, header.resultMsg || 'API 오류', apiId)
  }
  return json
}

function bodyItems(json) {
  const body = json?.response?.body ?? json?.body ?? json
  const items = body?.items?.item ?? body?.items ?? []
  return { items: asArray(items), totalCount: Number(body?.totalCount ?? 0) }
}

// ---------- 기상청 격자 변환 (LCC DFS) ----------
export function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
  const DEGRAD = Math.PI / 180.0
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) }
}

function haversine(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// ---------- 날씨 ----------
function ncstBase() {
  const d = kstNow()
  if (d.getUTCMinutes() < 45) d.setUTCHours(d.getUTCHours() - 1)
  return { base_date: ymd(d), base_time: `${pad(d.getUTCHours())}00` }
}
function vilageBase() {
  const d = new Date(kstNow().getTime() - 15 * 60e3)
  const hours = [2, 5, 8, 11, 14, 17, 20, 23]
  let h = hours.filter((x) => x <= d.getUTCHours()).pop()
  if (h === undefined) {
    d.setUTCDate(d.getUTCDate() - 1)
    h = 23
  }
  return { base_date: ymd(d), base_time: `${pad(h)}00` }
}

async function weatherNow(nx, ny, key) {
  return cached(`ncst:${nx},${ny}`, 15 * 60e3, async () => {
    const json = await callDataGo('weather', '/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', { dataType: 'JSON', numOfRows: 20, pageNo: 1, nx, ny, ...ncstBase() }, key)
    const { items } = bodyItems(json)
    const out = {}
    for (const it of items) out[it.category] = Number(it.obsrValue)
    const b = items[0]
    // 결측값(-998.9 등) 제거
    const v = (x) => (x == null || x <= -900 ? null : x)
    return {
      t: v(out.T1H), reh: v(out.REH), wsd: v(out.WSD), pty: v(out.PTY) ?? 0, rn1: v(out.RN1) ?? 0, vec: v(out.VEC),
      baseTime: b ? `${b.baseDate} ${b.baseTime}` : null,
    }
  })
}

async function weatherForecast(nx, ny, key) {
  return cached(`fcst:${nx},${ny}`, 30 * 60e3, async () => {
    const json = await callDataGo('weather', '/1360000/VilageFcstInfoService_2.0/getVilageFcst', { dataType: 'JSON', numOfRows: 1000, pageNo: 1, nx, ny, ...vilageBase() }, key)
    const byTime = new Map()
    for (const it of bodyItems(json).items) {
      const k = `${it.fcstDate}${it.fcstTime}`
      if (!byTime.has(k)) byTime.set(k, { date: it.fcstDate, time: it.fcstTime })
      byTime.get(k)[it.category] = it.fcstValue
    }
    const nowKey = (() => {
      const d = kstNow()
      return `${ymd(d)}${pad(d.getUTCHours())}00`
    })()
    return [...byTime.values()]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .filter((h) => h.TMP !== undefined && h.date + h.time >= nowKey)
      .slice(0, 36)
      .map((h) => ({
        date: h.date, time: h.time,
        t: Number(h.TMP), reh: Number(h.REH), wsd: Number(h.WSD), pty: Number(h.PTY ?? 0),
        pop: Number(h.POP ?? 0), sky: Number(h.SKY ?? 1), pcp: h.PCP,
        rn1: h.PCP && /\d/.test(h.PCP) ? parseFloat(h.PCP) : 0,
      }))
  })
}

// ---------- 대기질 ----------
function num(v) {
  const n = Number(v)
  return v === '-' || v === '' || v == null || Number.isNaN(n) ? null : n
}
async function airBySido(sidoShort, key) {
  return cached(`air:${sidoShort}`, 20 * 60e3, async () => {
    const json = await callDataGo('air', '/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty', { returnType: 'json', numOfRows: 300, pageNo: 1, sidoName: sidoShort, ver: '1.0' }, key)
    return bodyItems(json).items.map((it) => ({
      stationName: it.stationName,
      pm10: num(it.pm10Value), pm25: num(it.pm25Value), o3: num(it.o3Value),
      khai: num(it.khaiValue), dataTime: it.dataTime,
    }))
  })
}
async function stationsBySido(sidoShort, key) {
  const addr = SIDO.find((s) => s.short === sidoShort)?.stationAddr || sidoShort
  return cached(`stations:${sidoShort}`, 24 * 3600e3, async () => {
    const json = await callDataGo('station', '/B552584/MsrstnInfoInqireSvc/getMsrstnList', { returnType: 'json', numOfRows: 300, pageNo: 1, addr }, key)
    return bodyItems(json).items
      .map((it) => {
        const a = Number(it.dmX), b = Number(it.dmY)
        const lat = a < 90 ? a : b, lng = a < 90 ? b : a
        return { stationName: it.stationName, addr: it.addr, lat, lng }
      })
      .filter((s) => s.lat && s.lng)
  })
}

// 측정소 좌표를 이용해 가장 가까운 측정소의 값을 고른다 (없으면 시도 평균)
function pickAir(point, air, stations) {
  const valid = air.filter((a) => a.pm10 != null || a.pm25 != null)
  if (!valid.length) return null
  const avg = (k) => {
    const v = valid.map((a) => a[k]).filter((x) => x != null)
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null
  }
  if (point && stations?.length) {
    const ranked = stations.map((s) => ({ ...s, dist: haversine(point, s) })).sort((a, b) => a.dist - b.dist)
    for (const s of ranked) {
      const a = valid.find((x) => x.stationName === s.stationName)
      if (a) return { ...a, distKm: Math.round(s.dist * 10) / 10, source: 'station' }
    }
  }
  return { stationName: `${valid.length}개 측정소 평균`, pm10: avg('pm10'), pm25: avg('pm25'), o3: null, dataTime: valid[0].dataTime, source: 'average' }
}

// ---------- 두루누비 (걷기길) ----------
const stripHtml = (s) =>
  (s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()

async function allCourses(key) {
  return cached('courses', 6 * 3600e3, async () => {
    const list = []
    for (let page = 1; page <= 10; page++) {
      const json = await callDataGo('durunubi', '/B551011/Durunubi/courseList', { numOfRows: 1000, pageNo: page, MobileOS: 'ETC', MobileApp: 'gachi-geotgae', _type: 'json', brdDiv: 'DNWW' }, key)
      const { items, totalCount } = bodyItems(json)
      list.push(...items)
      if (!items.length || list.length >= totalCount) break
    }
    let routes = []
    try {
      routes = await allRoutes(key)
    } catch {
      /* 길 테마 정보는 선택 */
    }
    const routeMap = new Map(routes.map((r) => [String(r.routeIdx), r]))
    return list.map((c) => normalizeCourse(c, routeMap.get(String(c.routeIdx))))
  })
}
async function allRoutes(key) {
  return cached('routes', 6 * 3600e3, async () => {
    const json = await callDataGo('durunubi', '/B551011/Durunubi/routeList', { numOfRows: 100, pageNo: 1, MobileOS: 'ETC', MobileApp: 'gachi-geotgae', _type: 'json', brdDiv: 'DNWW' }, key)
    return bodyItems(json).items
  })
}
function normalizeCourse(c, route) {
  return {
    id: String(c.crsIdx),
    routeIdx: c.routeIdx,
    name: c.crsKorNm,
    distanceKm: num(c.crsDstnc),
    minutes: num(c.crsTotlRqrmHour),
    level: num(c.crsLevel), // 1 쉬움, 2 보통, 3 어려움
    cycle: c.crsCycle, // 순환형/비순환형
    sigun: (c.sigun || '').trim(),
    summary: stripHtml(c.crsSummary),
    contents: stripHtml(c.crsContents),
    tourInfo: stripHtml(c.crsTourInfo),
    travelerInfo: stripHtml(c.travelerinfo),
    gpxpath: c.gpxpath,
    modified: c.modifiedtime,
    theme: route ? { name: route.themeNm, line: stripHtml(route.linemsg), desc: stripHtml(route.themedescs) } : null,
  }
}

const GPX_HOSTS = ['durunubi.kr', 'www.durunubi.kr']
async function gpxTrack(gpxUrl) {
  return cached(`gpx:${gpxUrl}`, 24 * 3600e3, async () => {
    const u = new URL(gpxUrl)
    if (!GPX_HOSTS.includes(u.hostname)) throw new ApiError('BAD_GPX', '허용되지 않은 경로 파일 주소입니다.', 'durunubi')
    const res = await fetch(u, { signal: AbortSignal.timeout(20000) })
    const text = await res.text()
    const pts = []
    const re = /<(?:trkpt|rtept)\s+([^>]*?)\/?>([\s\S]*?)(?=<(?:trkpt|rtept)\s|<\/trkseg|<\/rte|<\/gpx|$)/g
    let m
    while ((m = re.exec(text))) {
      const lat = Number((m[1].match(/lat="([^"]+)"/) || [])[1])
      const lon = Number((m[1].match(/lon="([^"]+)"/) || [])[1])
      const ele = Number((m[2].match(/<ele>([^<]+)<\/ele>/) || [])[1])
      if (lat && lon) pts.push([lat, lon, Number.isFinite(ele) ? ele : null])
    }
    if (!pts.length) throw new ApiError('NO_TRACK', '경로 파일에 좌표가 없습니다.', 'durunubi')
    return summarizeTrack(pts)
  })
}
function summarizeTrack(pts) {
  let dist = 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    dist += haversine({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] })
    cum.push(dist)
  }
  // 지도/차트용으로 최대 600개 지점으로 줄임
  const step = Math.max(1, Math.ceil(pts.length / 600))
  const points = []
  for (let i = 0; i < pts.length; i += step) points.push([+pts[i][0].toFixed(6), +pts[i][1].toFixed(6), pts[i][2], +cum[i].toFixed(3)])
  const last = pts[pts.length - 1]
  if (points[points.length - 1][3] !== +dist.toFixed(3)) points.push([+last[0].toFixed(6), +last[1].toFixed(6), last[2], +dist.toFixed(3)])
  const eles = pts.map((p) => p[2]).filter((e) => e != null)
  let gain = 0
  for (let i = 1; i < eles.length; i++) if (eles[i] > eles[i - 1]) gain += eles[i] - eles[i - 1]
  return {
    points,
    start: { lat: pts[0][0], lng: pts[0][1] },
    end: { lat: last[0], lng: last[1] },
    distanceKm: Math.round(dist * 100) / 100,
    elevation: eles.length ? { min: Math.round(Math.min(...eles)), max: Math.round(Math.max(...eles)), gain: Math.round(gain) } : null,
  }
}

async function mapLimit(arr, limit, fn) {
  const out = new Array(arr.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, arr.length) }, async () => {
      while (i < arr.length) {
        const idx = i++
        try {
          out[idx] = await fn(arr[idx], idx)
        } catch {
          out[idx] = null
        }
      }
    }),
  )
  return out
}

// ---------- 시도 (대표 지점: 시청·도청 소재지) ----------
export const SIDO = [
  { short: '서울', names: ['서울특별시', '서울'], spot: '서울시청', center: [37.5663, 126.9779] },
  { short: '부산', names: ['부산광역시', '부산'], spot: '부산시청', center: [35.1798, 129.075] },
  { short: '대구', names: ['대구광역시', '대구'], spot: '대구시청', center: [35.8714, 128.6014] },
  { short: '인천', names: ['인천광역시', '인천'], spot: '인천시청', center: [37.4563, 126.7052] },
  { short: '대전', names: ['대전광역시', '대전'], spot: '대전시청', center: [36.3504, 127.3845] },
  { short: '울산', names: ['울산광역시', '울산'], spot: '울산시청', center: [35.5396, 129.3115] },
  { short: '세종', names: ['세종특별자치시', '세종'], spot: '세종시청', center: [36.48, 127.289] },
  { short: '경기', names: ['경기도', '경기'], spot: '수원시(경기도청)', center: [37.2893, 127.0535] },
  { short: '강원', names: ['강원특별자치도', '강원도', '강원'], spot: '춘천시(강원도청)', center: [37.8853, 127.7298] },
  { short: '충북', names: ['충청북도', '충북'], spot: '청주시(충북도청)', center: [36.6358, 127.4913] },
  { short: '충남', names: ['충청남도', '충남'], spot: '홍성군(충남도청)', center: [36.6588, 126.6728] },
  { short: '전북', names: ['전북특별자치도', '전라북도', '전북'], spot: '전주시(전북도청)', center: [35.8205, 127.1088] },
  // 2026년 광주광역시 + 전라남도 통합. 에어코리아 시도명은 '전남광주', 측정소 주소 검색은 '전남'
  { short: '전남광주', names: ['전남광주통합특별시', '광주광역시', '전라남도', '전남', '광주'], spot: '광주시청 일대', center: [35.1601, 126.8514], stationAddr: '전남' },
  { short: '경북', names: ['경상북도', '경북'], spot: '안동시(경북도청)', center: [36.5759, 128.5056] },
  { short: '경남', names: ['경상남도', '경남'], spot: '창원시(경남도청)', center: [35.2383, 128.6925] },
  { short: '제주', names: ['제주특별자치도', '제주도', '제주'], spot: '제주시(제주도청)', center: [33.4890, 126.4983] },
]
export function sidoOf(text) {
  const t = (text || '').trim()
  for (const s of SIDO) if (s.names.some((n) => t.startsWith(n + ' ') || t === n)) return s.short
  return null
}

// ---------- 도시공원 (전국도시공원정보표준데이터) ----------
// 걷기 좋은 공원 종류만 사용 (어린이공원·소공원은 규모가 작아 제외)
const WALK_PARK = /근린|수변|체육|역사|문화|생태|도시자연|도시농업|방재|묘지/
// 프로젝트 루트의 cityparkdata.csv (CP949, 한글 헤더) 를 읽는다. 파일이 바뀌면 다시 읽음.
let parkCache = null
export function allParks() {
  const file = path.resolve(process.cwd(), 'cityparkdata.csv')
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    throw new ApiError('NO_FILE', '프로젝트 폴더에서 cityparkdata.csv 파일을 찾지 못했습니다.', null)
  }
  if (parkCache?.mtime === stat.mtimeMs) return parkCache.data
  const buf = fs.readFileSync(file)
  const isUtf8 = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
  const [head, ...rows] = parseCsv(new TextDecoder(isUtf8 ? 'utf-8' : 'euc-kr').decode(buf))
  const keys = head.map((h) => h.trim())
  const seen = new Set()
  const data = rows
    .map((r) => normalizePark(Object.fromEntries(keys.map((k, i) => [k, r[i]]))))
    .filter((p) => {
      if (!p.lat || !p.name || !p.sido || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  parkCache = { mtime: stat.mtimeMs, data }
  return data
}
function normalizePark(r) {
  const g = (...ks) => {
    for (const k of ks) if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim()
    return ''
  }
  const lat = Number(g('latitude', '위도'))
  const lng = Number(g('longitude', '경도'))
  const addr = g('rdnmadr', '소재지도로명주소') || g('lnmadr', '소재지지번주소')
  const tokens = addr.split(/\s+/)
  const facilities = {
    운동: g('mvmFclty', '공원보유시설(운동시설)'),
    유희: g('amsmtFclty', '공원보유시설(유희시설)'),
    편익: g('cnvnncFclty', '공원보유시설(편익시설)'),
    교양: g('cltrFclty', '공원보유시설(교양시설)'),
    기타: g('etcFclty', '공원보유시설(기타시설)'),
  }
  const tidy = (v) => v.replace(/\s*\+\s*/g, ', ')
  return {
    id: 'park-' + (g('manageNo', '관리번호') || `${g('parkNm', '공원명')}-${lat}`),
    name: g('parkNm', '공원명'),
    kind: g('parkSe', '공원구분'),
    addr,
    sido: sidoOf(addr) || sidoOf(g('institutionNm', '관리기관명')) || sidoOf(g('제공기관명')),
    sigungu: tokens[1] || '',
    lat: lat > 32 && lat < 39 ? lat : null,
    lng: lng > 124 && lng < 132 ? lng : null,
    areaM2: Number(String(g('parkAr', '공원면적')).replace(/,/g, '')) || null,
    facilities: Object.fromEntries(Object.entries(facilities).filter(([, v]) => v && v !== '-' && v !== '없음').map(([k, v]) => [k, tidy(v)])),
    since: g('appnNtfcDate', '지정고시일'),
    org: g('institutionNm', '관리기관명'),
    tel: g('phoneNumber', '전화번호'),
    updated: g('referenceDate', '데이터기준일자'),
  }
}
async function regionParks(sidoShort) {
  const parks = allParks()
  const sorted = parks.filter((p) => p.sido === sidoShort && WALK_PARK.test(p.kind)).sort((a, b) => (b.areaM2 || 0) - (a.areaM2 || 0))
  // 같은 공원이 관리번호만 달리 중복 등록된 경우 (이름+시군구 기준, 큰 면적 하나만)
  const seen = new Set()
  return sorted.filter((p) => {
    const k = `${p.name.replace(/\s/g, '')}|${p.sigungu}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---------- 반려동물 동반여행 (한국관광공사 KorPetTourService2) ----------
async function petPlaces(lat, lng, radius, key) {
  const k = `pet:${lat.toFixed(3)},${lng.toFixed(3)},${radius}`
  return cached(k, 6 * 3600e3, async () => {
    const json = await callDataGo('pettour', '/B551011/KorPetTourService2/locationBasedList2', {
      numOfRows: 100, pageNo: 1, MobileOS: 'ETC', MobileApp: 'gachi-geotgae', _type: 'json',
      mapX: lng, mapY: lat, radius, arrange: 'E',
    }, key)
    return bodyItems(json).items.map((it) => ({
      id: String(it.contentid),
      title: it.title,
      typeId: String(it.contenttypeid || ''),
      addr: [it.addr1, it.addr2].filter(Boolean).join(' '),
      tel: it.tel || '',
      image: https(it.firstimage || it.firstimage2 || ''),
      lat: Number(it.mapy) || null,
      lng: Number(it.mapx) || null,
      distM: it.dist != null ? Math.round(Number(it.dist)) : null,
    }))
  })
}
async function petDetail(id, key) {
  return cached(`petd:${id}`, 24 * 3600e3, async () => {
    const json = await callDataGo('pettour', '/B551011/KorPetTourService2/detailPetTour2', { MobileOS: 'ETC', MobileApp: 'gachi-geotgae', _type: 'json', contentId: id }, key)
    const it = bodyItems(json).items[0] || {}
    return {
      allowed: stripHtml(it.acmpyPsblCpam), // 동반 가능 동물
      need: stripHtml(it.acmpyNeedMtr), // 동반 시 필요사항
      type: stripHtml(it.acmpyTypeCd), // 동반 구분 (전체/일부 구역)
      facility: stripHtml(it.relaPosesFclty), // 관련 구비 시설
      etc: stripHtml(it.etcAcmpyInfo),
      risk: stripHtml(it.relaAcdntRiskMtr), // 사고 예방 관련 사항
    }
  })
}
const PET_TYPE = { 12: '관광지', 14: '문화시설', 15: '축제·행사', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' }

// 선택 API: 승인 전이면 null + 사유를 돌려준다
async function optional(fn) {
  try {
    return { data: await fn(), status: 'ok' }
  } catch (e) {
    return { data: null, status: e.code || 'ERROR', message: e.message }
  }
}

async function regionCourses(sidoShort, key) {
  const courses = await allCourses(key)
  const regional = courses.filter((c) => sidoOf(c.sigun) === sidoShort)
  const tracks = await mapLimit(regional, 6, (c) => (c.gpxpath ? gpxTrack(c.gpxpath) : null))
  return regional.map((c, i) => {
    const tr = tracks[i]
    return { ...c, start: tr?.start ?? null, end: tr?.end ?? null, trackKm: tr?.distanceKm ?? null }
  })
}

async function courseCounts(key) {
  const courses = await allCourses(key)
  const out = Object.fromEntries(SIDO.map((s) => [s.short, 0]))
  for (const c of courses) {
    const s = sidoOf(c.sigun)
    if (s) out[s]++
  }
  return out
}

// ---------- 산책지수용 지역 데이터 ----------
async function regionConditions(sidoShort, key) {
  const sido = SIDO.find((s) => s.short === sidoShort)
  if (!sido) throw new ApiError('BAD_SIDO', '알 수 없는 지역입니다.', null)
  const [courses, air, stations, counts, parksRes] = await Promise.all([
    regionCourses(sidoShort, key),
    airBySido(sidoShort, key),
    stationsBySido(sidoShort, key).catch(() => []),
    courseCounts(key),
    optional(() => regionParks(sidoShort)),
  ])
  // 산책지수는 규모가 큰 공원 30곳만 계산 (기상청 호출량 관리)
  const parks = (parksRes.data || []).slice(0, 30)

  const center = { lat: sido.center[0], lng: sido.center[1] }
  const centerGrid = toGrid(center.lat, center.lng)
  const grids = new Map([[`${centerGrid.nx},${centerGrid.ny}`, centerGrid]])
  for (const c of [...courses, ...parks]) {
    const p = c.start || (c.lat ? { lat: c.lat, lng: c.lng } : center)
    c.grid = toGrid(p.lat, p.lng)
    grids.set(`${c.grid.nx},${c.grid.ny}`, c.grid)
  }
  const gridWeather = new Map()
  let weatherError = null
  await mapLimit([...grids.entries()], 6, async ([k, g]) => {
    try {
      gridWeather.set(k, await weatherNow(g.nx, g.ny, key))
    } catch (e) {
      weatherError = e
    }
  })
  if (!gridWeather.size && weatherError) throw weatherError

  return {
    sido: sidoShort,
    center: sido.center,
    updatedAt: new Date().toISOString(),
    counts,
    here: {
      id: 'here',
      name: `${sido.names[0]} ${sido.spot} 주변`,
      spot: sido.spot,
      start: center,
      grid: centerGrid,
      weather: gridWeather.get(`${centerGrid.nx},${centerGrid.ny}`) || null,
      air: pickAir(center, air, stations),
    },
    courses: courses.map((c) => ({
      ...c,
      weather: gridWeather.get(`${c.grid.nx},${c.grid.ny}`) || null,
      air: pickAir(c.start, air, stations),
    })),
    parks: parks.map((p) => ({
      ...p,
      start: { lat: p.lat, lng: p.lng },
      weather: gridWeather.get(`${p.grid.nx},${p.grid.ny}`) || null,
      air: pickAir({ lat: p.lat, lng: p.lng }, air, stations),
    })),
    parksStatus: parksRes.status,
  }
}

// ---------- 유기동물 ----------
const ADOPT = '/1543061/abandonmentPublicService_v2'
async function adopt(op, params, key) {
  const json = await callDataGo('adopt', `${ADOPT}/${op}`, { _type: 'json', pageNo: 1, numOfRows: 1000, ...params }, key)
  return bodyItems(json)
}
function normalizeAnimal(a) {
  return {
    id: String(a.desertionNo),
    image: https(a.popfile1 || a.popfile || ''),
    images: [a.popfile1, a.popfile2, a.popfile3, a.popfile4, a.popfile5, a.popfile6, a.popfile7, a.popfile8].filter(Boolean).map(https),
    upKind: a.upKindNm || (String(a.kindFullNm || '').match(/\[(.+?)\]/) || [])[1] || '',
    kind: a.kindNm || String(a.kindFullNm || '').replace(/\[.+?\]\s*/, ''),
    color: a.colorCd || '',
    age: a.age || '',
    weight: a.weight || '',
    sex: a.sexCd, // M, F, Q
    neuter: a.neuterYn, // Y, N, U
    special: a.specialMark || '',
    happenDt: a.happenDt, happenPlace: a.happenPlace || '',
    noticeNo: a.noticeNo || '', noticeStart: a.noticeSdt, noticeEnd: a.noticeEdt,
    state: a.processState || '',
    careName: a.careNm || '', careTel: a.careTel || '', careAddr: (a.careAddr || '').trim(),
    orgName: a.orgNm || '', vaccination: a.vaccinationChk || '', health: a.healthChk || '',
    etc: a.etcBigo || '',
    updated: a.updTm || '',
  }
}

// ---------- 생활·보건기상지수 (자외선, 꽃가루) ----------
// 기상청 지수 지역코드 (전남광주통합특별시는 아직 코드가 없어 제외)
const INDEX_AREA = {
  서울: '1100000000', 부산: '2600000000', 대구: '2700000000', 인천: '2800000000', 대전: '3000000000', 울산: '3100000000',
  세종: '3611000000', 경기: '4100000000', 강원: '5100000000', 충북: '4300000000', 충남: '4400000000', 전북: '5200000000',
  경북: '4700000000', 경남: '4800000000', 제주: '5000000000',
}
function indexBaseTime(stepHours) {
  // 지수는 06·18시(꽃가루) 또는 매시(자외선)에 발표 — 1시간 여유를 두고 가장 최근 발표 시각
  const d = new Date(kstNow().getTime() - 60 * 60e3)
  if (stepHours === 12) {
    const h = d.getUTCHours()
    if (h < 6) {
      d.setUTCDate(d.getUTCDate() - 1)
      return `${ymd(d)}18`
    }
    return `${ymd(d)}${h < 18 ? '06' : '18'}`
  }
  return `${ymd(d)}${pad(d.getUTCHours())}`
}
// h0, h3, h6 … 형태의 시간별 값을 [{at:'YYYYMMDDHH', v}]로 변환
function hourlySeries(item) {
  const base = String(item.date || '')
  if (base.length < 10) return []
  const t0 = Date.UTC(+base.slice(0, 4), +base.slice(4, 6) - 1, +base.slice(6, 8), +base.slice(8, 10))
  return Object.keys(item)
    .filter((k) => /^h\d+$/.test(k) && item[k] !== '' && item[k] != null)
    .map((k) => {
      const d = new Date(t0 + Number(k.slice(1)) * 3600e3)
      return { at: `${ymd(d)}${pad(d.getUTCHours())}`, v: Number(item[k]) }
    })
    .sort((a, b) => a.at.localeCompare(b.at))
}
async function uvIndex(sidoShort, key) {
  const areaNo = INDEX_AREA[sidoShort]
  if (!areaNo) throw new ApiError('NO_AREA', '이 지역은 자외선 지수를 제공하지 않습니다.', 'living')
  const time = indexBaseTime(1)
  return cached(`uv:${areaNo}:${time}`, 60 * 60e3, async () => {
    const json = await callDataGo('living', '/1360000/LivingWthrIdxServiceV5/getUVIdxV5', { dataType: 'JSON', numOfRows: 10, pageNo: 1, areaNo, time }, key)
    const item = bodyItems(json).items[0]
    if (!item) throw new ApiError('NO_DATA', '자외선 지수 자료가 없습니다.', 'living')
    return { base: item.date, series: hourlySeries(item) }
  })
}
const POLLEN = [
  { id: 'oak', label: '참나무 꽃가루', op: 'getOakPollenRiskIdxV3', months: [3, 4, 5, 6] },
  { id: 'pine', label: '소나무 꽃가루', op: 'getPinePollenRiskIdxV3', months: [3, 4, 5, 6] },
  { id: 'weeds', label: '잡초 꽃가루', op: 'getWeedsPollenRiskndxV3', months: [8, 9, 10] },
]
async function pollenIndex(sidoShort, key) {
  const areaNo = INDEX_AREA[sidoShort]
  const month = kstNow().getUTCMonth() + 1
  const active = POLLEN.filter((p) => p.months.includes(month))
  if (!areaNo || !active.length) return { inSeason: false, items: [] }
  const time = indexBaseTime(12)
  return cached(`pollen:${areaNo}:${time}`, 3 * 3600e3, async () => {
    const items = await mapLimit(active, 3, async (p) => {
      const json = await callDataGo('health', `/1360000/HealthWthrIdxServiceV3/${p.op}`, { dataType: 'JSON', numOfRows: 10, pageNo: 1, areaNo, time }, key)
      const it = bodyItems(json).items[0]
      if (!it) return null
      // 값: 0 낮음, 1 보통, 2 높음, 3 매우높음 — 응답 형식(오늘/내일 또는 시간별)을 모두 처리
      const today = it.today ?? it.todayValue ?? hourlySeries(it)[0]?.v
      const tomorrow = it.tomorrow ?? null
      return { id: p.id, label: p.label, today: today === '' || today == null ? null : Number(today), tomorrow: tomorrow === '' || tomorrow == null ? null : Number(tomorrow) }
    })
    return { inSeason: true, items: items.filter(Boolean) }
  })
}

// ---------- 기상특보 (승인되면 자동 표시) ----------
async function weatherWarnings(sidoShort, key) {
  return cached('warn', 10 * 60e3, async () => {
    const json = await callDataGo('warning', '/1360000/WthrWrnInfoService/getPwnStatus', { dataType: 'JSON', numOfRows: 10, pageNo: 1 }, key)
    const it = bodyItems(json).items[0] || {}
    return { tm: it.tmFc || '', text: stripHtml(it.t6 || '') }
  }).then((w) => {
    const sido = SIDO.find((s) => s.short === sidoShort)
    // '강원도', '경상북도' 처럼 특보문에 쓰이는 이름의 앞부분 (예: 경상북도 → 경상북)
    const names = [...new Set([sido.short, ...sido.names].map((n) => n.replace(/(특별|광역|자치|통합)?(시|도)$/, '')).filter((n) => n.length >= 2))]
    const out = []
    // 't6' 은 "o 한파주의보 : 경기도(가평, 양평서부), 강원도(태백, 영월), 대구 ..." 형식
    for (const raw of w.text.split(/\n|(?=o\s)/)) {
      const line = raw.replace(/^o\s*/, '').trim()
      const [title, list = ''] = line.split(/\s*:\s*/)
      // 바다 특보(풍랑·해일)는 산책과 관계없어 제외
      if (!title || /풍랑|해일|없음/.test(title)) continue
      // 괄호 밖의 쉼표로만 나눈다
      const segs = []
      let depth = 0
      let cur = ''
      for (const ch of list) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) {
          segs.push(cur.trim())
          cur = ''
        } else cur += ch
      }
      if (cur.trim()) segs.push(cur.trim())
      // 지역 이름이 구간 맨 앞에 올 때만 해당 시도로 본다 ('경기도(광주…)'가 광주로 잡히지 않게)
      const mine = segs.filter((s) => names.some((n) => s.startsWith(n)))
      if (mine.length) out.push({ title, areas: mine })
    }
    return { tm: w.tm, items: [...new Set(out.map((o) => o.title))], detail: out.map((o) => `${o.title}: ${o.areas.join(', ')}`) }
  })
}

// ---------- 보호소 (구조동물 목록에서 보호소별로 집계) ----------
async function shelters(uprCd, orgCd, key) {
  return cached(`shelters:${uprCd}:${orgCd || ''}`, 30 * 60e3, async () => {
    const bgnde = ymd(new Date(kstNow().getTime() - 60 * 86400e3))
    const params = { upr_cd: uprCd, bgnde, endde: ymd(kstNow()), numOfRows: 1000 }
    if (orgCd) params.org_cd = orgCd
    const { items } = await adopt('abandonmentPublic_v2', params, key)
    const map = new Map()
    for (const a of items) {
      const k = a.careRegNo || a.careNm
      if (!k) continue
      if (!map.has(k)) map.set(k, { id: a.careRegNo || '', name: a.careNm, tel: a.careTel || '', addr: (a.careAddr || '').trim(), org: a.orgNm || '', total: 0, protect: 0, notice: 0, dogs: 0, cats: 0, etc: 0, latest: '' })
      const s = map.get(k)
      s.total++
      if (/보호/.test(a.processState)) s.protect++
      if (a.noticeEdt && a.noticeEdt >= ymd(kstNow())) s.notice++
      if (a.upKindCd === '417000') s.dogs++
      else if (a.upKindCd === '422400') s.cats++
      else s.etc++
      if ((a.happenDt || '') > s.latest) s.latest = a.happenDt
    }
    return [...map.values()].sort((a, b) => b.protect - a.protect || b.total - a.total)
  })
}

// ---------- 라우터 ----------
export function createApiMiddleware(getKey) {
  return async function handler(req, res, next) {
    if (!req.url.startsWith('/api/')) return next()
    const url = new URL(req.url, 'http://localhost')
    const q = Object.fromEntries(url.searchParams)
    const key = getKey()
    const send = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(body))
    }
    const ok = (data, meta) => send(200, { data, ...(meta ? { meta } : {}) })
    try {
      switch (url.pathname) {
        case '/api/walk/region':
          return ok(await regionConditions(q.sido || '서울', key))
        case '/api/weather/forecast': {
          const { nx, ny } = q.lat ? toGrid(Number(q.lat), Number(q.lng)) : { nx: q.nx, ny: q.ny }
          return ok(await weatherForecast(nx, ny, key))
        }
        case '/api/trails': {
          if (q.sido) return ok(await regionCourses(q.sido, key), { counts: await courseCounts(key) })
          return ok(await allCourses(key))
        }
        case '/api/indices': {
          const sido = q.sido || '서울'
          const [uv, pollen, warn] = await Promise.all([optional(() => uvIndex(sido, key)), optional(() => pollenIndex(sido, key)), optional(() => weatherWarnings(sido, key))])
          return ok({ uv: uv.data, pollen: pollen.data, warnings: warn.data, status: { uv: uv.status, pollen: pollen.status, warnings: warn.status } })
        }
        case '/api/shelters':
          return ok(await shelters(q.upr_cd, q.org_cd, key))
        case '/api/places/types':
          return ok(availablePlaceTypes())
        case '/api/places': {
          let entry
          try {
            entry = loadPlaces(q.type || 'hospital', sidoOf)
          } catch {
            return send(404, { error: { code: 'NO_FILE', message: '해당 CSV 파일을 프로젝트 폴더에서 찾지 못했습니다.' } })
          }
          // 전국 목록은 수 MB라 Vercel 응답 한도(4.5MB)를 넘으므로 지역 또는 반경으로 잘라 보낸다
          let list
          if (q.lat && q.lng) {
            const c = { lat: Number(q.lat), lng: Number(q.lng) }
            const r = Math.min(20, Number(q.radius) || 10)
            list = entry.data.filter((h) => h.lat && Math.abs(h.lat - c.lat) < r / 100 && Math.abs(h.lng - c.lng) < r / 80).filter((h) => haversine(c, h) <= r)
          } else if (q.sido) {
            list = entry.data.filter((h) => h.sido === q.sido)
          } else {
            return send(400, { error: { code: 'NEED_AREA', message: '지역(sido) 또는 위치(lat,lng)를 함께 보내 주세요.' } })
          }
          // 화면에서 쓰지 않는 중복 주소 필드는 빼서 응답을 가볍게
          const slim = list.map((h) => ({ id: h.id, name: h.name, addr: h.addr, tel: h.tel, lat: h.lat, lng: h.lng, sido: h.sido, sigungu: h.sigungu }))
          return ok(slim, { updated: entry.updated })
        }
        case '/api/parks':
          return ok(await regionParks(q.sido || '서울'))
        case '/api/pet/nearby': {
          const places = await petPlaces(Number(q.lat), Number(q.lng), Math.min(20000, Number(q.radius) || 5000), key)
          return ok(places.map((p) => ({ ...p, type: PET_TYPE[p.typeId] || '기타' })))
        }
        case '/api/pet/detail':
          return ok(await petDetail(q.id, key))
        case '/api/trails/counts':
          return ok(await courseCounts(key))
        case '/api/trails/track': {
          const all = await allCourses(key)
          const c = all.find((x) => x.id === q.id)
          if (!c) return send(404, { error: { code: 'NOT_FOUND', message: '산책로를 찾지 못했습니다.' } })
          if (!c.gpxpath) return send(404, { error: { code: 'NO_TRACK', message: '이 산책로는 경로 파일이 제공되지 않습니다.' } })
          return ok({ course: c, track: await gpxTrack(c.gpxpath) })
        }
        case '/api/adopt/sido':
          return ok((await cached('adopt:sido', 24 * 3600e3, () => adopt('sido_v2', {}, key))).items)
        case '/api/adopt/sigungu':
          return ok((await cached(`adopt:sgg:${q.upr_cd}`, 24 * 3600e3, () => adopt('sigungu_v2', { upr_cd: q.upr_cd }, key))).items)
        case '/api/adopt/kind':
          return ok((await cached(`adopt:kind:${q.up_kind_cd}`, 24 * 3600e3, () => adopt('kind_v2', { up_kind_cd: q.up_kind_cd }, key))).items)
        case '/api/adopt/list': {
          const params = {}
          for (const k of ['bgnde', 'endde', 'upkind', 'kind', 'upr_cd', 'org_cd', 'care_reg_no', 'state', 'neuter_yn', 'pageNo', 'numOfRows']) if (q[k]) params[k] = q[k]
          const r = await cached(`adopt:${JSON.stringify(params)}`, 5 * 60e3, () => adopt('abandonmentPublic_v2', { numOfRows: 24, ...params }, key))
          return ok({ items: r.items.map(normalizeAnimal), totalCount: r.totalCount })
        }
        case '/api/status': {
          const checks = {
            weather: () => weatherNow(89, 90, key),
            air: () => airBySido('대구', key),
            station: () => stationsBySido('대구', key),
            durunubi: () => allRoutes(key),
            adopt: () => adopt('sido_v2', {}, key),
            pettour: () => petPlaces(35.1798, 129.075, 3000, key),
            living: () => uvIndex('대구', key),
            health: () => callDataGo('health', '/1360000/HealthWthrIdxServiceV3/getOakPollenRiskIdxV3', { dataType: 'JSON', numOfRows: 1, pageNo: 1, areaNo: '2700000000', time: indexBaseTime(12) }, key).catch((e) => { if (e.code === 'RESULT_99') return null; throw e }),
            warning: () => weatherWarnings('대구', key),
          }
          const out = await Promise.all(
            Object.entries(checks).map(async ([id, fn]) => {
              try {
                await fn()
                return { id, ...APIS[id], ok: true }
              } catch (e) {
                return { id, ...APIS[id], ok: false, code: e.code, message: e.message }
              }
            }),
          )
          let hosp
          try {
            hosp = { id: 'hospital', name: 'veter.csv (행정안전부 동물병원)', ok: true, count: loadHospitals(sidoOf).length }
          } catch (e) {
            hosp = { id: 'hospital', name: 'veter.csv (행정안전부 동물병원)', ok: false, message: e.message }
          }
          let parkFile
          try {
            parkFile = { id: 'park', name: 'cityparkdata.csv (전국도시공원정보표준데이터)', ok: true, count: allParks().length }
          } catch (e) {
            parkFile = { id: 'park', name: 'cityparkdata.csv (전국도시공원정보표준데이터)', ok: false, message: e.message }
          }
          return send(200, { data: [...out, hosp, parkFile] })
        }
        default:
          return send(404, { error: { code: 'NOT_FOUND', message: '없는 경로입니다.' } })
      }
    } catch (e) {
      const api = e.api ? APIS[e.api] : null
      return send(502, { error: { code: e.code || 'ERROR', message: e.message, api } })
    }
  }
}

// 빌드 시 sitemap 생성용: 걷기길 상세 페이지 목록
export async function listCourseIds(key) {
  return (await allCourses(key)).map((c) => ({ id: c.id, modified: c.modified }))
}
