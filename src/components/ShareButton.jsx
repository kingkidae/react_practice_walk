import { useState } from 'react'
import { shareCard } from '../lib/shareCard.js'

export default function ShareButton({ data, className = 'btn btn--ghost btn--sm' }) {
  const [state, setState] = useState('')
  const run = async () => {
    setState('making')
    try {
      const r = await shareCard(data)
      setState(r === 'saved' ? 'saved' : '')
    } catch {
      setState('error')
    }
  }
  return (
    <span className="share">
      <button type="button" className={className} onClick={run} disabled={state === 'making'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
        {state === 'making' ? '카드 만드는 중…' : '산책 카드 공유'}
      </button>
      {state === 'saved' && <span className="hint" role="status">이미지를 저장했어요. 카카오톡이나 SNS에 올려 보세요.</span>}
      {state === 'error' && <span className="hint hint--error" role="status">카드를 만들지 못했어요.</span>}
    </span>
  )
}
