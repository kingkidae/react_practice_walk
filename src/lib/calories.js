// 칼로리 계산 공식
// - 사람: ACSM 보행/달리기 대사 방정식 (VO2, mL/kg/min) → kcal = VO2 × 체중 / 1000 × 5
// - 반려견: Taylor et al.(1982) 포유류 이동 대사 방정식
//     P(W/kg) = 10.7 · M^-0.316 · v + 6.03 · M^-0.303   (M: kg, v: m/s)

export const DOG_SIZES = [
  { id: 'small', label: '소형견', range: '10kg 미만', example: '말티즈 · 푸들 · 포메', defaultKg: 4, dailyMin: [30, 60] },
  { id: 'medium', label: '중형견', range: '10~25kg', example: '시바 · 비글 · 웰시코기', defaultKg: 15, dailyMin: [60, 90] },
  { id: 'large', label: '대형견', range: '25kg 이상', example: '골든 리트리버 · 래브라도', defaultKg: 30, dailyMin: [90, 120] },
]

export const SPEEDS = [
  { id: 'slow', label: '천천히', kmh: 3, desc: '냄새 맡으며 느긋하게' },
  { id: 'normal', label: '보통', kmh: 4.5, desc: '일반적인 산책' },
  { id: 'brisk', label: '빠르게', kmh: 6, desc: '파워 워킹' },
  { id: 'jog', label: '조깅', kmh: 8, desc: '함께 달리기' },
]

export const TERRAINS = [
  { id: 'flat', label: '평지', grade: 0, dogFactor: 1 },
  { id: 'gentle', label: '완만한 언덕', grade: 0.03, dogFactor: 1.15 },
  { id: 'hill', label: '오르막 많은 산길', grade: 0.08, dogFactor: 1.3 },
]

export const DOG_STYLES = [
  { id: 'calm', label: '옆에서 차분히', factor: 1 },
  { id: 'sniff', label: '이리저리 탐색', factor: 1.15 },
  { id: 'run', label: '뛰어다니는 편', factor: 1.35 },
]

export function ownerCalories({ weightKg, heightCm, age, sex, kmh, minutes, grade }) {
  const mPerMin = (kmh * 1000) / 60
  const running = kmh >= 7.5
  const vo2 = running ? 0.2 * mPerMin + 0.9 * mPerMin * grade + 3.5 : 0.1 * mPerMin + 1.8 * mPerMin * grade + 3.5
  const kcal = ((vo2 * weightKg) / 1000) * 5 * minutes
  const met = vo2 / 3.5
  const distanceKm = (kmh * minutes) / 60
  const stride = (heightCm * (running ? 0.65 : sex === 'F' ? 0.413 : 0.415)) / 100 // m
  const steps = stride > 0 ? Math.round((distanceKm * 1000) / stride) : 0
  const bmr = sex === 'F' ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161 : 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  const bmi = weightKg / (heightCm / 100) ** 2
  return { kcal, met, steps, bmr, bmi, distanceKm, running }
}

export function dogCalories({ weightKg, kmh, minutes, terrainFactor, styleFactor, neutered }) {
  const v = (kmh * styleFactor) / 3.6 // m/s, 탐색/뛰기 성향만큼 실제 이동이 늘어남
  const pPerKg = 10.7 * weightKg ** -0.316 * v + 6.03 * weightKg ** -0.303
  const kcal = (pPerKg * weightKg * minutes * 60 * terrainFactor) / 4184
  const rer = 70 * weightKg ** 0.75
  const mer = rer * (neutered ? 1.6 : 1.8)
  return { kcal, rer, mer, ratio: kcal / mer, distanceKm: ((kmh * minutes) / 60) * styleFactor }
}

// 보호자 정보는 칼로리 계산기에서 저장한 값을 사용 (없으면 평균값)
export function loadOwner() {
  try {
    const v = JSON.parse(localStorage.getItem('gachi-geotgae:calorie-profile') || 'null')
    if (v?.owner?.weight) return v.owner
  } catch {
    /* 무시 */
  }
  return { height: 168, weight: 62, age: 30, sex: 'F' }
}

// 기록된 산책(거리·시간)의 칼로리
export function walkKcal({ km, minutes, profile }) {
  if (!minutes) return { dog: 0, owner: 0 }
  const kmh = Math.min(9, Math.max(1.5, (km || 0) / (minutes / 60) || 4.5))
  const owner = loadOwner()
  const o = ownerCalories({ weightKg: +owner.weight, heightCm: +owner.height, age: +owner.age || 30, sex: owner.sex, kmh, minutes, grade: 0 })
  const d = profile?.weight
    ? dogCalories({ weightKg: +profile.weight, kmh, minutes, terrainFactor: 1, styleFactor: 1.15, neutered: profile.neutered !== false })
    : null
  return { owner: Math.round(o.kcal), dog: d ? Math.round(d.kcal) : null, steps: o.steps }
}
