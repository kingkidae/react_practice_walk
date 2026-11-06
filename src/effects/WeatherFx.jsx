import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { reducedMotion } from './fx.js'
import { snowTexture, softDotTexture, sparkleTexture } from './textures.js'

/**
 * 지금 날씨를 카드 배경에 3D 입자로 보여준다.
 * mode: 'rain' | 'snow' | 'dust' | 'sun' | 'calm'
 */
export default function WeatherFx({ mode = 'calm' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || reducedMotion()) return
    const host = canvas.parentElement
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
    } catch {
      return // WebGL 미지원 기기는 효과 없이
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(dpr)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10)
    const sys = makeSystem(mode, dpr)
    scene.add(sys.object)

    let w = 1
    let h = 1
    const resize = () => {
      w = Math.max(1, host.clientWidth)
      h = Math.max(1, host.clientHeight)
      renderer.setSize(w, h, false)
      camera.right = w
      camera.top = h
      camera.updateProjectionMatrix()
      sys.resize(w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // 화면에 보일 때만 움직인다
    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
    })
    io.observe(host)

    let raf = 0
    let last = performance.now()
    let t = 0
    const frame = (now) => {
      raf = 0
      if (!visible || document.hidden) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      sys.update(dt, t, w, h)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    function start() {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => !document.hidden && start()
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      sys.dispose()
      renderer.dispose()
    }
  }, [mode])

  return <canvas ref={ref} className="weather-fx" aria-hidden="true" />
}

const rand = (a, b) => a + Math.random() * (b - a)

function makeSystem(mode, dpr) {
  if (mode === 'rain') return rain()
  if (mode === 'snow') return points({ count: 70, tex: snowTexture(), color: '#ffffff', size: 7 * dpr, opacity: 0.95, speed: [18, 40], sway: 22, dir: -1 })
  if (mode === 'dust') return points({ count: 90, tex: softDotTexture(), color: '#8a7a66', size: 16 * dpr, opacity: 0.35, speed: [3, 9], sway: 14, dir: 1 })
  if (mode === 'sun') return points({ count: 45, tex: sparkleTexture(), color: '#fff6dc', size: 14 * dpr, opacity: 0.95, speed: [6, 16], sway: 10, dir: 1, twinkle: true })
  return points({ count: 22, tex: softDotTexture(), color: '#fff8ea', size: 10 * dpr, opacity: 0.6, speed: [4, 10], sway: 12, dir: 1, twinkle: true })
}

// 떠다니는(또는 떨어지는) 점 입자.
// 입자마다 크기·투명도를 따로 주는 작은 셰이더 — 깜빡일 때 어두운 점이 생기지 않고, 크기 차이로 원근감이 난다.
const VERT = `
attribute float aAlpha;
attribute float aSize;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = `
uniform sampler2D map;
uniform vec3 color;
uniform float opacity;
varying float vAlpha;
void main() {
  float a = texture2D(map, gl_PointCoord).a * vAlpha * opacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(color, a);
}`

function points({ count, tex, color, size, opacity, speed, sway, dir, twinkle = false }) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const alpha = new Float32Array(count)
  const sizes = new Float32Array(count)
  const p = Array.from({ length: count }, () => {
    const depth = rand(0.45, 1) // 가까운 입자일수록 크고 빠르다
    return { x: Math.random(), y: Math.random(), v: rand(...speed) * depth, ph: rand(0, Math.PI * 2), sw: rand(0.5, 1.5), depth }
  })
  p.forEach((q, i) => (sizes[i] = size * q.depth))
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  })
  const obj = new THREE.Points(geo, mat)
  let W = 1
  let H = 1
  return {
    object: obj,
    resize(w, h) {
      // 처음엔 0~1 비율로 두었다가 실제 크기로 펼친다
      if (W === 1 && H === 1) p.forEach((q) => { q.x *= w; q.y *= h })
      W = w
      H = h
    },
    update(dt, t) {
      for (let i = 0; i < count; i++) {
        const q = p[i]
        q.y += dir * q.v * dt
        q.x += Math.sin(t * 0.6 * q.sw + q.ph) * sway * q.depth * dt
        if (dir > 0 && q.y > H + 10) { q.y = -10; q.x = Math.random() * W }
        if (dir < 0 && q.y < -10) { q.y = H + 10; q.x = Math.random() * W }
        if (q.x < -10) q.x = W + 10
        if (q.x > W + 10) q.x = -10
        pos[i * 3] = q.x
        pos[i * 3 + 1] = q.y
        alpha[i] = (twinkle ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 * q.sw + q.ph)) : 1) * (0.55 + 0.45 * q.depth)
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      tex.dispose()
    },
  }
}

// 비스듬히 떨어지는 빗줄기 (선분)
function rain() {
  const count = 140
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 6)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false })
  const obj = new THREE.LineSegments(geo, mat)
  const d = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), len: rand(10, 22), v: rand(380, 560) }))
  const slant = 0.18
  let W = 1
  let H = 1
  return {
    object: obj,
    resize(w, h) {
      if (W === 1 && H === 1) d.forEach((q) => { q.x *= w; q.y *= h })
      W = w
      H = h
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        const q = d[i]
        q.y -= q.v * dt
        q.x -= q.v * slant * dt
        if (q.y < -q.len) { q.y = H + rand(0, 40); q.x = rand(0, W + H * slant) }
        pos[i * 6] = q.x
        pos[i * 6 + 1] = q.y
        pos[i * 6 + 3] = q.x + q.len * slant
        pos[i * 6 + 4] = q.y + q.len
      }
      geo.attributes.position.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
