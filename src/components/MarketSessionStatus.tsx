import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { exchangeCalendar } from '../../lib/exchange-calendar.js'
import { dataTime } from '../utils/dataTime'
import './MarketSessionStatus.css'

const stamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
const labels = { 'before-open': '개장 전', open: '정규장 시간', 'after-close': '정규장 종료 시간 이후', holiday: '휴장일', weekend: '주말', unavailable: '일정 미확인' }
export default function MarketSessionStatus() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  const { state, session, nextSession } = exchangeCalendar.status(now)
  const info = exchangeCalendar.info
  return <section className="market-session-status" aria-label="미국 정규장 일정">
    <div className="market-session-summary"><strong>미국 정규장 · NYSE 기준</strong><span className={`market-session-state state-${state}`}>{labels[state]}{session?.earlyClose ? ' · 조기 폐장일' : ''}</span>
      <span>{state === 'open' && session ? `예정 폐장 ${stamp(session.close)} KST` : nextSession ? `다음 개장 ${stamp(nextSession.open)} KST` : '다음 개장 미확인'}</span><Link to="/calendar">휴장 일정 ↗</Link></div>
    <details><summary>예정 일정 기준 ⓘ</summary><p>NYSE 현물 주식 정규장 시간표이며 실제 거래 상태·임시 휴장·거래 중단을 확인하는 정보가 아닙니다. 장전·장후 거래는 포함하지 않습니다. 시세의 기준 시각과 별개입니다.</p>
      {info && <p>공식 일정 확인 {dataTime(info.reviewedAt)} · 적용 범위 {info.from} – {info.to} · <a href={info.url} target="_blank" rel="noopener noreferrer">NYSE 공식 일정 ↗</a></p>}</details>
  </section>
}
