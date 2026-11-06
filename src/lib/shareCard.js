// 오늘의 산책 카드 이미지 만들기 + 공유 (Web Share API, 안 되면 저장)
const W = 1080
const H = 1350

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function wrap(ctx, text, maxWidth, maxLines) {
  const lines = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines) break
    } else line += ch
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && ctx.measureText(text).width > maxWidth * maxLines) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  return lines
}

/**
 * data: { place, score, grade, toneColor, note, facts: [[label, value]], bestTime, dogName }
 */
export async function makeCard(data) {
  await Promise.all([document.fonts.load('80px Jua'), document.fonts.load('40px "Gowun Dodum"')]).catch(() => {})
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const bg = cssVar('--bg', '#fbf5ec')
  const ink = cssVar('--ink', '#3a2a1f')
  const soft = cssVar('--ink-soft', '#7a6555')
  const golden = cssVar('--golden', '#e3a65b')
  const goldenDeep = cssVar('--golden-deep', '#b97a35')
  const light = cssVar('--golden-light', '#f4ddb8')
  const tone = data.toneColor?.startsWith('var(') ? cssVar(data.toneColor.slice(4, -1), '#4e8f3e') : data.toneColor || '#4e8f3e'
  const display = 'Jua, "Gowun Dodum", sans-serif'
  const body = '"Gowun Dodum", "Malgun Gothic", sans-serif'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.arc(W - 90, 120, 210, 0, Math.PI * 2)
  ctx.fill()

  // 상단
  ctx.fillStyle = ink
  ctx.font = `64px ${display}`
  ctx.fillText('같이 걷개', 80, 140)
  ctx.fillStyle = soft
  ctx.font = `36px ${body}`
  ctx.fillText(data.dogName ? `${data.dogName}의 오늘 산책지수` : '오늘의 산책지수', 80, 200)

  // 점수 카드
  roundRect(ctx, 60, 260, W - 120, 560, 48)
  ctx.fillStyle = golden
  ctx.fill()
  const cx = 280
  const cy = 540
  ctx.fillStyle = '#fffdf9'
  ctx.beginPath()
  ctx.arc(cx, cy, 170, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 26
  ctx.strokeStyle = '#f1e4d1'
  ctx.beginPath()
  ctx.arc(cx, cy, 140, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = tone
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, 140, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0, Math.min(100, data.score))) / 100)
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = `120px ${display}`
  ctx.textAlign = 'center'
  ctx.fillText(String(data.score), cx, cy + 42)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#5a3f22'
  ctx.font = `34px ${body}`
  wrap(ctx, data.place, 520, 2).forEach((l, i) => ctx.fillText(l, 500, 420 + i * 46))
  ctx.fillStyle = ink
  ctx.font = `76px ${display}`
  ctx.fillText(data.grade, 500, 560)
  ctx.font = `32px ${body}`
  wrap(ctx, data.note || '', 500, 3).forEach((l, i) => ctx.fillText(l, 500, 630 + i * 44))

  // 날씨 정보
  const facts = data.facts.slice(0, 4)
  const colW = (W - 120 - 30) / Math.max(1, facts.length)
  facts.forEach(([label, value], i) => {
    const x = 60 + i * (colW + 10)
    roundRect(ctx, x, 860, colW, 170, 32)
    ctx.fillStyle = '#fffdf9'
    ctx.fill()
    ctx.fillStyle = soft
    ctx.font = `30px ${body}`
    ctx.fillText(label, x + 30, 915)
    ctx.fillStyle = ink
    ctx.font = `50px ${display}`
    ctx.fillText(value, x + 30, 985)
  })

  if (data.bestTime) {
    roundRect(ctx, 60, 1070, W - 120, 120, 32)
    ctx.fillStyle = ink
    ctx.fill()
    ctx.fillStyle = light
    ctx.font = `40px ${display}`
    ctx.fillText(`추천 산책 시간  ${data.bestTime}`, 100, 1145)
  }
  ctx.fillStyle = goldenDeep
  ctx.font = `28px ${body}`
  ctx.fillText('기상청·에어코리아 공공데이터 기반', 80, H - 70)

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

export async function shareCard(data) {
  const blob = await makeCard(data)
  const file = new File([blob], '같이걷개-산책지수.png', { type: 'image/png' })
  const text = `${data.place} 지금 산책지수 ${data.score}점 (${data.grade})`
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '같이 걷개', text, url: location.href })
      return 'shared'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancel'
  }
  // 공유를 지원하지 않으면 이미지 저장
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'saved'
}
