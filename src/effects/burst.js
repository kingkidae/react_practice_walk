import * as THREE from 'three'
import { pawTexture } from './textures.js'

// 화면 전체를 덮는 투명 캔버스에 3D 발바닥을 날린다. 효과가 끝나면 캔버스와 GPU 자원을 정리한다.
const COLORS = ['#e3a65b', '#b97a35', '#f4ddb8', '#6b9a55', '#3a2a1f', '#ffffff']
let stage = null

function getStage() {
  if (stage) return stage
  const canvas = document.createElement('canvas')
  canvas.className = 'fx-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.z = 10
  const tex = pawTexture('#ffffff')
  const s = { canvas, renderer, scene, camera, tex, parts: [], raf: 0, last: 0, w: 1, h: 1, unit: 1, pending: 0, running: false }
  const resize = () => {
    s.w = window.innerWidth
    s.h = window.innerHeight
    renderer.setSize(s.w, s.h, false)
    camera.aspect = s.w / s.h
    camera.updateProjectionMatrix()
    // z=0 평면에서 1px 이 몇 단위인지
    s.unit = (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)) / s.h
  }
  resize()
  window.addEventListener('resize', resize)
  s.cleanup = () => {
    window.removeEventListener('resize', resize)
    s.parts.forEach((p) => p.sprite.material.dispose())
    tex.dispose()
    renderer.dispose()
    canvas.remove()
    stage = null
  }
  stage = s
  return s
}

// 화면 좌표(px) → 3D 좌표
const toWorld = (s, x, y) => ({ x: (x - s.w / 2) * s.unit, y: (s.h / 2 - y) * s.unit })

function addPaw(s, { x, y, vx, vy, vz, life, size, gravity, sway = 0 }) {
  const mat = new THREE.SpriteMaterial({ map: s.tex, color: COLORS[Math.floor(Math.random() * COLORS.length)], transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  const p = toWorld(s, x, y)
  sprite.position.set(p.x, p.y, (Math.random() - 0.5) * 2)
  sprite.scale.setScalar(size)
  mat.rotation = Math.random() * Math.PI * 2
  s.scene.add(sprite)
  s.parts.push({ sprite, vx, vy, vz, spin: (Math.random() - 0.5) * 8, age: 0, life, gravity, sway, phase: Math.random() * 6 })
}

function loop(now) {
  const s = stage
  if (!s) return
  const dt = Math.min(0.05, (now - s.last) / 1000)
  s.last = now
  for (const p of s.parts) {
    p.age += dt
    p.vy -= p.gravity * dt
    p.sprite.position.x += (p.vx + Math.sin(p.age * 3 + p.phase) * p.sway) * dt
    p.sprite.position.y += p.vy * dt
    p.sprite.position.z += p.vz * dt
    p.sprite.material.rotation += p.spin * dt
    const fade = Math.min(1, (p.life - p.age) / 0.7)
    p.sprite.material.opacity = Math.max(0, fade)
  }
  // 수명이 다한 입자 제거
  s.parts = s.parts.filter((p) => {
    if (p.age < p.life) return true
    s.scene.remove(p.sprite)
    p.sprite.material.dispose()
    return false
  })
  s.renderer.render(s.scene, s.camera)
  if (s.parts.length || s.pending > 0) s.raf = requestAnimationFrame(loop)
  else {
    s.running = false
    s.cleanup()
  }
}

function run(s) {
  if (s.running) return
  s.running = true
  s.last = performance.now()
  s.raf = requestAnimationFrame(loop)
}

/** 한 지점에서 발바닥이 터져 나온다 */
export function burst({ x = window.innerWidth / 2, y = window.innerHeight / 2, count = 46 } = {}) {
  const s = getStage()
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 4 + Math.random() * 7
    addPaw(s, { x, y, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 3, vz: (Math.random() - 0.5) * 6, life: 1.8 + Math.random() * 1, size: 0.35 + Math.random() * 0.45, gravity: 9 })
  }
  run(s)
}

/** 하늘에서 발바닥이 비처럼 내린다 */
export function pawRain({ duration = 4 } = {}) {
  const s = getStage()
  const total = Math.round(duration * 28)
  s.pending += total
  let made = 0
  const timer = setInterval(() => {
    if (!stage) return clearInterval(timer)
    for (let k = 0; k < 2 && made < total; k++, made++) {
      addPaw(s, { x: Math.random() * s.w, y: -30, vx: (Math.random() - 0.5) * 1.5, vy: -(2 + Math.random() * 2.5), vz: (Math.random() - 0.5) * 1.5, life: 4.5, size: 0.3 + Math.random() * 0.5, gravity: 0.6, sway: 1.2 })
      s.pending--
    }
    if (made >= total) clearInterval(timer)
  }, 70)
  run(s)
}
