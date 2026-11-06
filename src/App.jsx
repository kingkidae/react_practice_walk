import { Suspense, lazy, useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/ui.jsx'
import { useDogProfile } from './lib/dogProfile.js'

// 메뉴별로 코드를 나눠 첫 화면을 빠르게 (Core Web Vitals)
const WalkIndex = lazy(() => import('./pages/WalkIndex.jsx'))
const WalkDetail = lazy(() => import('./pages/WalkDetail.jsx'))
const Trails = lazy(() => import('./pages/Trails.jsx'))
const TrailDetail = lazy(() => import('./pages/TrailDetail.jsx'))
const Calories = lazy(() => import('./pages/Calories.jsx'))
const Hospitals = lazy(() => import('./pages/Hospitals.jsx'))
const Adopt = lazy(() => import('./pages/Adopt.jsx'))
const AdoptDetail = lazy(() => import('./pages/AdoptDetail.jsx'))
const Me = lazy(() => import('./pages/Me.jsx'))

const NAV = [
  { to: '/walk', label: '산책 지수', icon: SunIcon },
  { to: '/trails', label: '산책로 정보', short: '산책로', icon: TrailIcon },
  { to: '/calories', label: '칼로리 계산기', short: '칼로리', icon: FlameIcon },
  { to: '/hospitals', label: '병원 정보', short: '병원', icon: CrossIcon },
  { to: '/adopt', label: '입양하개', icon: HeartIcon },
]

function Logo() {
  return (
    <NavLink to="/walk" className="logo" aria-label="같이 걷개 홈">
      <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="var(--golden)" />
        <path d="M14 22c-5 3-6 15-2 21 5-2 8-10 8-17zM50 22c5 3 6 15 2 21-5-2-8-10-8-17z" fill="var(--golden-deep)" />
        <circle cx="25" cy="31" r="3" fill="var(--ink)" />
        <circle cx="39" cy="31" r="3" fill="var(--ink)" />
        <ellipse cx="32" cy="40" rx="5" ry="3.6" fill="var(--ink)" />
        <path d="M30 46q2 3 4 0" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span>같이 걷개</span>
    </NavLink>
  )
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <a className="skip" href="#main">본문으로 건너뛰기</a>
      <header className="topbar">
        <div className="topbar__inner">
          <Logo />
          <div className="topbar__right">
            <nav className="topnav" aria-label="주요 메뉴">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="topnav__link">
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <MeLink />
          </div>
        </div>
      </header>

      <main id="main" className="main">
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/walk" replace />} />
          <Route path="/walk" element={<WalkIndex />} />
          <Route path="/walk/:sido/:id" element={<WalkDetail />} />
          <Route path="/trails" element={<Trails />} />
          <Route path="/trails/:id" element={<TrailDetail />} />
          <Route path="/calories" element={<Calories />} />
          <Route path="/hospitals" element={<Hospitals />} />
          <Route path="/adopt" element={<Adopt />} />
          <Route path="/adopt/:id" element={<AdoptDetail />} />
          <Route path="/me" element={<Me />} />
          <Route path="*" element={<Navigate to="/walk" replace />} />
        </Routes>
        </Suspense>
      </main>

      <footer className="footer">
        <p>
          날씨 기상청 · 대기질 한국환경공단 에어코리아 · 걷기길 한국관광공사 두루누비 · 동물병원 행정안전부 인허가 데이터 · 유기동물 농림축산검역본부 국가동물보호정보시스템
        </p>
        <p>공공데이터포털(data.go.kr) 오픈 API를 활용했어요.</p>
      </footer>

      <nav className="tabbar" aria-label="주요 메뉴">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="tabbar__link">
            <n.icon />
            <span>{n.short || n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function MeLink() {
  const p = useDogProfile()
  return (
    <NavLink to="/me" className="me-link" aria-label="내 산책 기록과 우리 강아지">
      <span className="me-link__face" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 64 64">
          <path d="M14 22c-5 3-6 15-2 21 5-2 8-10 8-17zM50 22c5 3 6 15 2 21-5-2-8-10-8-17z" fill="var(--golden-deep)" />
          <circle cx="25" cy="31" r="3.4" fill="var(--ink)" />
          <circle cx="39" cy="31" r="3.4" fill="var(--ink)" />
          <ellipse cx="32" cy="41" rx="5" ry="3.6" fill="var(--ink)" />
        </svg>
      </span>
      {p?.name || '내 산책'}
    </NavLink>
  )
}

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  )
}
function TrailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="18" r="2.2" />
      <path d="M8 18h6a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h7" />
      <path d="M17 1.8 19.5 4 17 6.2" />
    </svg>
  )
}
function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.4 2.4-5.4 3.6-8.4.5 2 1.6 3 2.6 3.4C11.2 6.4 12.6 4 15 2.5c-.3 3.2 1 5.2 2.3 6.9 1 1.3 1.7 3 1.7 5.5 0 3.8-3 6.6-7 6.6z" />
    </svg>
  )
}
function CrossIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" />
    </svg>
  )
}
