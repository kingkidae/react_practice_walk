import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createApiMiddleware, listCourseIds } from './server/publicApi.js'

// .env 의 API_KEY 는 서버(미들웨어)에서만 사용하고 브라우저 번들에는 포함하지 않는다.
function publicDataApi(env) {
  const middleware = createApiMiddleware(() => (env.API_KEY || '').trim())
  return {
    name: 'public-data-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// SEO: index.html 의 %SITE_URL% 치환, robots.txt / sitemap.xml 생성
const STATIC_ROUTES = [
  ['/walk', 'hourly', '1.0'],
  ['/trails', 'weekly', '0.9'],
  ['/calories', 'monthly', '0.7'],
  ['/hospitals', 'weekly', '0.8'],
  ['/adopt', 'daily', '0.8'],
]
function seo(env) {
  const site = (env.SITE_URL || '').replace(/\/$/, '')
  return {
    name: 'seo',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', site)
    },
    async generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', site ? `Sitemap: ${site}/sitemap.xml` : ''].filter(Boolean).join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots + '\n' })
      if (!site) {
        this.warn('SITE_URL 이 없어 sitemap.xml 을 만들지 않았습니다. .env 에 SITE_URL=https://도메인 을 추가하세요.')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const urls = STATIC_ROUTES.map(([p, freq, pri]) => ({ loc: site + p, lastmod: today, freq, pri }))
      try {
        for (const c of await listCourseIds((env.API_KEY || '').trim())) {
          const m = c.modified || ''
          urls.push({ loc: `${site}/trails/${c.id}`, lastmod: m.length >= 8 ? `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}` : today, freq: 'monthly', pri: '0.6' })
        }
      } catch (e) {
        this.warn(`걷기길 목록을 가져오지 못해 sitemap 에서 상세 페이지를 뺐습니다: ${e.message}`)
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
        .join('\n')}\n</urlset>\n`
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), publicDataApi(env), seo(env)],
    server: { host: true },
    build: {
      rollupOptions: {
        output: {
          // 지도 라이브러리는 별도 파일로 분리해 첫 화면 로딩을 가볍게
          manualChunks(id) {
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet') || id.includes('@react-leaflet')) return 'map'
            if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          },
        },
      },
    },
  }
})
