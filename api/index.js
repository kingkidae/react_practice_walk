// Vercel 서버리스 함수: 개발 서버(Vite)에서 쓰던 /api 중계 코드를 그대로 재사용한다.
// vercel.json 의 rewrites 가 /api/* 요청을 이 함수로 보낸다 (/api?__path=walk/region&sido=...)
import { createApiMiddleware } from '../server/publicApi.js'

const handler = createApiMiddleware(() => (process.env.VITE_API_KEY || '').trim())

export default async function vercelApi(req, res) {
  const u = new URL(req.url, 'http://localhost')
  const p = u.searchParams.get('__path')
  if (p != null) {
    u.searchParams.delete('__path')
    const rest = u.searchParams.toString()
    req.url = `/api/${p}${rest ? `?${rest}` : ''}`
  } else if (!u.pathname.startsWith('/api/')) {
    req.url = `/api${u.pathname === '/' ? '/status' : u.pathname}${u.search}`
  }

  if (!process.env.VITE_API_KEY && !req.url.startsWith('/api/places')) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: { code: 'NO_KEY', message: 'Vercel 환경변수에 VITE_API_KEY 가 없습니다. Project Settings → Environment Variables 에 추가한 뒤 다시 배포하세요.' } }))
  }

  // 같은 요청은 Vercel CDN 에서 잠시 재사용 (공공데이터 호출량·함수 실행 줄이기)
  const pathname = req.url.split('?')[0]
  const ttl = pathname.startsWith('/api/status')
    ? 0
    : /\/api\/(places|parks|trails|adopt\/(sido|sigungu|kind))/.test(pathname)
      ? 3600
      : 300
  res.setHeader('Cache-Control', ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}` : 'no-store')

  await handler(req, res, () => {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: '없는 경로입니다.' } }))
  })
}
