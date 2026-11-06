// 화면 효과 이벤트 (어느 컴포넌트에서든 호출 → App 의 FxOverlay 가 그린다)
export function fx(type, detail = {}) {
  window.dispatchEvent(new CustomEvent('gachi:fx', { detail: { type, ...detail } }))
}

export function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
