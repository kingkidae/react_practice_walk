// 기상청 생활·보건기상지수 도우미
const pad = (n) => String(n).padStart(2, '0')

export function kstParts(t = Date.now()) {
  const d = new Date(t + 9 * 3600e3)
  return { ymd: `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`, hh: pad(d.getUTCHours()), month: d.getUTCMonth() + 1 }
}

/** series: [{at:'YYYYMMDDHH', v}] 에서 해당 시각 직전(같거나 이전) 값 */
export function uvAt(series, ymd, hh) {
  if (!series?.length) return null
  const key = `${ymd}${hh}`
  let v = null
  for (const s of series) {
    if (s.at <= key) v = s.v
    else break
  }
  return v ?? series[0].v
}

/** 오늘 꽃가루 위험 단계 중 가장 높은 값 (0~3) */
export function pollenToday(pollen) {
  if (!pollen?.inSeason || !pollen.items?.length) return null
  const vals = pollen.items.map((i) => i.today).filter((v) => v != null)
  return vals.length ? Math.max(...vals) : null
}
