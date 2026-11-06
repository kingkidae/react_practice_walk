import { useEffect } from 'react'

const SITE = '같이 걷개'
const DEFAULT_DESC = '오늘 우리 동네 산책지수, 걷기길·공원 정보, 반려견 칼로리 계산기, 동물병원 찾기, 유기동물 입양 정보를 한곳에서 확인하세요.'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** 페이지별 제목·설명·canonical·OG 태그를 갱신한다 */
export function usePageMeta({ title, description = DEFAULT_DESC, noindex = false }) {
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : `${SITE} - 반려견 산책 지수와 산책로, 동물병원, 입양 정보`
    document.title = full
    const url = window.location.origin + window.location.pathname
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('name', 'twitter:title', full)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow')
    setCanonical(url)
  }, [title, description, noindex])
}
