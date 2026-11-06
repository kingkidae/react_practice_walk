import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useFavorites } from '../lib/favorites.js'
import { usePageMeta } from '../lib/seo.js'
import { fmtDate } from '../lib/geo.js'
import { Empty } from '../components/ui.jsx'
import { AnimalPhoto, HeartButton, StateBadge } from './Adopt.jsx'
import { sexLabel, dday, recallAnimal } from '../lib/ui-helpers.js'

function findAnimal(id, state, favList) {
  if (state?.animal?.id === id) return state.animal
  const f = favList.find((a) => a.id === id)
  if (f) return f
  return recallAnimal(id)
}

export default function AdoptDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const fav = useFavorites()
  const a = findAnimal(id, state, fav.list)
  const [photo, setPhoto] = useState(0)
  usePageMeta({ title: a ? `${a.kind || a.upKind} 입양 정보` : '입양 정보', description: a ? `${a.careName}에서 보호 중인 ${a.kind} (${a.age}, ${a.weight}). 공고번호 ${a.noticeNo}` : undefined, noindex: true })

  if (!a) {
    return (
      <div className="page">
        <Link to="/adopt" className="back">입양하개 목록</Link>
        <Empty title="이 아이의 정보를 다시 불러와야 해요">목록에서 다시 선택해 주세요. 찜해 둔 아이는 언제든 볼 수 있어요.</Empty>
      </div>
    )
  }

  const imgs = a.images?.length ? a.images : a.image ? [a.image] : []
  const d = dday(a.noticeEnd)
  const neuter = { Y: '했어요', N: '안 했어요', U: '확인 안 됨' }[a.neuter] || '확인 안 됨'

  return (
    <div className="page">
      <Link to="/adopt" className="back">입양하개 목록</Link>
      <div className="adopt-detail">
        <div className="adopt-detail__media">
          <AnimalPhoto a={{ ...a, image: imgs[photo] }} large />
          {imgs.length > 1 && (
            <div className="thumbs">
              {imgs.map((src, i) => (
                <button key={src} className={i === photo ? 'is-on' : ''} onClick={() => setPhoto(i)} aria-label={`사진 ${i + 1}`}>
                  <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="adopt-detail__info">
          <div className="animal__row">
            <StateBadge state={a.state} end={a.noticeEnd} />
            <span className="muted">공고번호 {a.noticeNo || '-'}</span>
          </div>
          <h1 className="page-title page-title--sm">{a.kind || a.upKind}</h1>
          <p className="muted">{a.upKind} · {sexLabel(a.sex)} · {a.age}</p>

          <HeartButton big on={fav.has(a.id)} onClick={() => fav.toggle(a)} name={a.kind} />

          <dl className="info-table">
            <Row k="털색" v={a.color} />
            <Row k="나이" v={a.age} />
            <Row k="몸무게" v={a.weight} />
            <Row k="중성화" v={neuter} />
            <Row k="특징" v={a.special} />
            <Row k="발견 장소" v={a.happenPlace} />
            <Row k="발견 날짜" v={fmtDate(a.happenDt)} />
            <Row k="공고 기간" v={`${fmtDate(a.noticeStart)} ~ ${fmtDate(a.noticeEnd)}${d != null && d >= 0 ? ` (${d}일 남음)` : ''}`} />
            {a.vaccination && <Row k="예방접종" v={a.vaccination} />}
            {a.health && <Row k="건강 상태" v={a.health} />}
          </dl>

          <section className="panel shelter">
            <h2 className="panel__title">보호소</h2>
            <p><strong>{a.careName || '-'}</strong></p>
            <p className="muted">{a.careAddr}</p>
            <p className="muted">관할: {a.orgName}</p>
            <div className="actions">
              {a.careTel && <a className="btn" href={`tel:${a.careTel.replace(/[^\d]/g, '')}`}>보호소에 전화하기</a>}
              {a.careAddr && <a className="btn btn--ghost" href={`https://map.kakao.com/link/search/${encodeURIComponent(a.careAddr)}`} target="_blank" rel="noreferrer">보호소 위치</a>}
            </div>
          </section>

          <details className="formula">
            <summary>입양 전에 확인할 것</summary>
            <p>공고 기간(보통 10일) 동안은 원래 보호자를 찾는 기간이라, 공고가 끝난 뒤 입양 상담이 시작돼요.</p>
            <p>보호소마다 입양 절차와 필요 서류가 달라요. 방문 전에 전화로 아이가 아직 보호 중인지 확인해 주세요.</p>
            <p>반려동물은 평생 함께하는 가족이에요. 가족 모두의 동의와 생활 환경을 먼저 살펴 주세요.</p>
          </details>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="info-table__row">
      <dt>{k}</dt>
      <dd>{v || '-'}</dd>
    </div>
  )
}
