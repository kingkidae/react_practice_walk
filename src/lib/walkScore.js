// 산책지수 계산 (100점 만점)
// 기온(체감) 30 · 강수 25 · 미세먼지 25 · 바람 10 · 습도 10
import { comfortShift } from './dogProfile.js'

function lerp(points, x) {
  if (x <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x0, y0] = points[i - 1]
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return points[points.length - 1][1]
}

export function feelsLike(t, wsd, reh) {
  if (t == null) return null
  const v = (wsd ?? 0) * 3.6 // km/h
  if (t <= 10 && v > 4.8) {
    return 13.12 + 0.6215 * t - 11.37 * v ** 0.16 + 0.3965 * t * v ** 0.16
  }
  if (t >= 26 && reh != null && reh > 60) return t + (reh - 60) * 0.08
  return t
}

export const PTY_LABEL = { 0: '강수 없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기', 5: '빗방울', 6: '빗방울·눈날림', 7: '눈날림' }
export const SKY_LABEL = { 1: '맑음', 3: '구름많음', 4: '흐림' }

export function pmGrade(type, v) {
  if (v == null) return { label: '정보 없음', level: -1 }
  const cuts = type === 'pm10' ? [30, 80, 150] : [15, 35, 75]
  const labels = ['좋음', '보통', '나쁨', '매우 나쁨']
  const level = v <= cuts[0] ? 0 : v <= cuts[1] ? 1 : v <= cuts[2] ? 2 : 3
  return { label: labels[level], level }
}

/**
 * profile: 우리 강아지 프로필 (dogProfile.js) — 있으면 체감 쾌적 범위를 아이에게 맞춤
 * uv: 자외선 지수 (0~11+), pollen: 꽃가루 위험 단계 (0~3), month: 1~12
 */
export function computeWalkScore({ weather, air, profile = null, uv = null, pollen = null, month = null }) {
  const shift = comfortShift(profile)
  const name = profile?.name?.trim()
  const who = name ? `${name}` : '우리 아이'
  const w = weather || {}
  const parts = []
  const notes = []
  const caps = []

  // 기온
  const feel = feelsLike(w.t, w.wsd, w.reh)
  let temp = 15
  if (feel != null) {
    const c = shift.cold
    const h = shift.heat
    temp = lerp([[-10 + c, 0], [-2 + c, 8], [5 + c, 20], [10 + c, 30], [22 - h, 30], [26 - h, 20], [29 - h, 10], [32 - h, 0]], feel)
  }
  parts.push({ key: 'temp', label: '기온', max: 30, score: temp, value: w.t != null ? `${w.t}°C (체감 ${Math.round(feel)}°C)` : '정보 없음' })

  // 강수
  let rain = 25
  const pty = Number(w.pty || 0)
  if (pty === 1 || pty === 4) rain = (w.rn1 ?? 0) >= 1 ? 0 : 6
  else if (pty === 5) rain = 10
  else if (pty === 2 || pty === 6) rain = 4
  else if (pty === 3 || pty === 7) rain = 8
  if (w.pop != null && pty === 0) rain = lerp([[0, 25], [30, 25], [60, 14], [80, 6], [100, 4]], w.pop)
  parts.push({ key: 'rain', label: '강수', max: 25, score: rain, value: pty ? `${PTY_LABEL[pty]}${w.rn1 ? ` ${w.rn1}mm` : ''}` : w.pop != null ? `강수확률 ${w.pop}%` : '강수 없음' })

  // 미세먼지
  const a = air || {}
  let dust = 15
  const g10 = pmGrade('pm10', a.pm10)
  const g25 = pmGrade('pm25', a.pm25)
  if (a.pm10 != null || a.pm25 != null) {
    const s10 = a.pm10 != null ? lerp([[0, 25], [30, 25], [80, 16], [150, 4], [200, 0]], a.pm10) : 25
    const s25 = a.pm25 != null ? lerp([[0, 25], [15, 25], [35, 16], [75, 4], [100, 0]], a.pm25) : 25
    dust = Math.min(s10, s25)
  }
  parts.push({ key: 'dust', label: '미세먼지', max: 25, score: dust, value: a.pm10 != null || a.pm25 != null ? `PM10 ${g10.label} · PM2.5 ${g25.label}` : '정보 없음' })

  // 바람
  const wind = w.wsd != null ? lerp([[0, 10], [4, 10], [7, 6], [10, 2], [14, 0]], w.wsd) : 7
  parts.push({ key: 'wind', label: '바람', max: 10, score: wind, value: w.wsd != null ? `${w.wsd}m/s` : '정보 없음' })

  // 습도
  const hum = w.reh != null ? lerp([[0, 4], [30, 8], [40, 10], [70, 10], [85, 5], [100, 2]], w.reh) : 7
  parts.push({ key: 'hum', label: '습도', max: 10, score: hum, value: w.reh != null ? `${w.reh}%` : '정보 없음' })

  // 상한 규칙과 산책 팁
  if (pty !== 0) {
    caps.push(45)
    notes.push('비나 눈이 와요. 짧게 다녀오거나 실내 놀이로 대신해 주세요. 다녀온 뒤엔 발과 배를 잘 말려 주세요.')
  }
  if (Math.max(g10.level, g25.level) === 3) {
    caps.push(30)
    notes.push('미세먼지가 매우 나빠요. 오늘은 실내에서 노즈워크를 추천해요.')
  } else if (Math.max(g10.level, g25.level) === 2) {
    caps.push(60)
    notes.push('미세먼지가 나빠요. 산책은 20분 안쪽으로 짧게, 다녀와서 털과 발을 닦아 주세요.')
  }
  const hot = 30 - shift.heat
  const cold = -5 + shift.cold
  if (feel != null && feel >= hot) {
    caps.push(35)
    notes.push('무척 더워요. 한낮 아스팔트는 발바닥 화상 위험이 있어요. 손등을 바닥에 7초 대 보고 뜨거우면 산책을 미뤄 주세요.')
  } else if (feel != null && feel >= hot - 4) {
    notes.push(profile?.brachy ? `더운 편이에요. ${who}는 단두종이라 호흡이 가빠지기 쉬워요. 이른 아침이나 해 진 뒤에 짧게 걸어 주세요.` : '더운 편이에요. 그늘 많은 길로, 물을 꼭 챙겨 주세요. 단두종(퍼그·불독)은 특히 조심하세요.')
  }
  if (feel != null && feel <= cold) {
    caps.push(40)
    notes.push('많이 추워요. 소형견·단모종은 옷을 입히고, 제설제 묻은 길은 피해 주세요.')
  } else if (feel != null && feel <= cold + 8) {
    notes.push(profile ? (shift.cold > 0 ? `쌀쌀해요. ${who}는 추위를 타는 편이라 옷을 입혀 주세요.` : `쌀쌀하지만 ${who}는 추위에 강한 편이에요.`) : '쌀쌀해요. 소형견과 노견은 옷을 입혀 주세요.')
  }
  if (w.wsd != null && w.wsd >= 9) notes.push('바람이 강해요. 날리는 물건에 놀라지 않게 리드줄을 짧게 잡아 주세요.')

  // 감점 항목: 자외선, 꽃가루(알레르기 있는 아이만)
  const deductions = []
  if (uv != null) {
    const d = uv >= 11 ? 10 : uv >= 8 ? 6 : uv >= 6 ? 3 : 0
    if (d) {
      deductions.push({ key: 'uv', label: '자외선', score: -d, value: `지수 ${uv} (${uvGrade(uv).label})` })
      notes.push('자외선이 강해요. 털이 짧거나 밝은 아이는 코·배 피부가 탈 수 있어요. 그늘 길로 걸어 주세요.')
    }
  }
  if (pollen != null && profile?.allergy) {
    const d = [0, 2, 6, 10][pollen] || 0
    if (d) {
      deductions.push({ key: 'pollen', label: '꽃가루', score: -d, value: POLLEN_LABEL[pollen] })
      notes.push(`꽃가루가 ${POLLEN_LABEL[pollen]} 단계예요. 알레르기가 있는 ${who}는 다녀와서 발과 얼굴을 꼭 닦아 주세요.`)
    }
  }
  // 진드기 활동기 안내 (데이터가 아닌 일반 기준: 4~11월, 기온 10°C 이상에서 활발)
  if (!notes.length) notes.push('산책하기 좋은 날씨예요. 충분히 냄새 맡을 시간을 주세요!')
  const tick = tickRisk(month, w.t)
  if (tick.level >= 1) notes.push(tick.note)

  let total = parts.reduce((s, p) => s + p.score, 0) + deductions.reduce((s, d) => s + d.score, 0)
  if (caps.length) total = Math.min(total, ...caps)
  total = Math.round(Math.max(0, Math.min(100, total)))
  return { total, parts: parts.map((p) => ({ ...p, score: Math.round(p.score) })), deductions, notes, grade: gradeOf(total), personalized: !!profile, reasons: shift.reasons, tick }
}

export function gradeOf(score) {
  if (score >= 85) return { label: '산책 최고', tone: 'great', emoji: '🐕' }
  if (score >= 70) return { label: '산책 좋아요', tone: 'good', emoji: '🐾' }
  if (score >= 50) return { label: '괜찮아요', tone: 'fair', emoji: '🦮' }
  if (score >= 30) return { label: '짧게만', tone: 'poor', emoji: '⏱️' }
  return { label: '실내 놀이 추천', tone: 'bad', emoji: '🏠' }
}

export function uvGrade(v) {
  if (v == null) return { label: '정보 없음', tone: null }
  if (v >= 11) return { label: '위험', tone: 'bad' }
  if (v >= 8) return { label: '매우 높음', tone: 'poor' }
  if (v >= 6) return { label: '높음', tone: 'fair' }
  if (v >= 3) return { label: '보통', tone: 'good' }
  return { label: '낮음', tone: 'great' }
}
export const POLLEN_LABEL = ['낮음', '보통', '높음', '매우 높음']

// 진드기 활동 안내 — 공공 API가 없어 일반적인 기준(월·기온)으로만 안내
export function tickRisk(month, t) {
  if (!month) return { level: 0 }
  const peak = [5, 6, 9, 10].includes(month)
  const active = month >= 4 && month <= 11
  if (!active || (t != null && t < 10)) return { level: 0, label: '낮음' }
  const level = peak ? 2 : 1
  return {
    level,
    label: level === 2 ? '활동 많음' : '활동기',
    note: level === 2
      ? '진드기가 가장 많은 시기예요. 풀숲·잔디 깊은 곳은 피하고, 산책 후 귀 뒤·겨드랑이·발가락 사이를 꼭 확인해 주세요.'
      : '진드기 활동기예요. 풀숲을 지난 뒤에는 빗질하며 몸을 확인해 주세요.',
  }
}
