import * as THREE from 'three'

// 이미지 파일 없이 캔버스로 그린 텍스처
function canvasTexture(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  draw(ctx, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function pawTexture(color = '#ffffff') {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = color
    const e = (x, y, rx, ry) => {
      ctx.beginPath()
      ctx.ellipse((x / 24) * s, (y / 24) * s, (rx / 24) * s, (ry / 24) * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    e(12, 16.2, 5.2, 4.4)
    e(5.2, 10.6, 2.2, 2.8)
    e(18.8, 10.6, 2.2, 2.8)
    e(9, 5.6, 2.1, 2.8)
    e(15, 5.6, 2.1, 2.8)
  })
}

export function softDotTexture() {
  return canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

export function snowTexture() {
  return canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.95)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function sparkleTexture() {
  return canvasTexture(64, (ctx, s) => {
    const c = s / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,248,220,0.7)')
    g.addColorStop(1, 'rgba(255,240,200,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(c, 6)
    ctx.lineTo(c, s - 6)
    ctx.moveTo(6, c)
    ctx.lineTo(s - 6, c)
    ctx.stroke()
  })
}
