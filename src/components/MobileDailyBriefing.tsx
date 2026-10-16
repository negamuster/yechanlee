import { useId } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Briefing } from '../lib/briefings'
import { kstTime } from '../lib/briefings'
import { briefingEventPreview, briefingSections, validMobileBriefingState, withoutCitations, eventTime } from '../lib/briefingPresentation'
import type { MobileBriefingState } from '../lib/briefingPresentation'
import { useSessionState } from '../hooks/useSessionState'
import { CitedText, SourceRefs } from './BriefingReferences'
import BriefingDetails from './BriefingDetails'
import SelectionButton from './SelectionButton'
import { BriefingDisclosure, BriefingTransition } from './BriefingMotion'
import './MobileDailyBriefing.css'

export function MobileBriefingCard({ item, state, onChange }: { item?: Briefing; state: MobileBriefingState; onChange: (value: MobileBriefingState) => void }) {
  const id = useId()
  const sections = briefingSections(item)
  const activeSection = sections.find(section => section.key === state.section)
  const preview = item ? briefingEventPreview(item) : undefined
  function focusNews(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    requestAnimationFrame(() => document.getElementById('home-news-title')?.focus({ preventScroll: true }))
  }
  return <section className="daily-briefing mobile-briefing" aria-labelledby={`${id}-title`}>
    <div className="mobile-briefing-kicker"><h2 id={`${id}-title`}><Link to="/briefings" data-widget-link aria-label="오늘의 브리핑 · 지난 브리핑 목록 보기">오늘의 브리핑</Link></h2></div>
    {item ? <>
      <div className="mobile-briefing-meta"><span>{item.sessionDate ? `미국 거래일 ${item.sessionDate}` : '뉴스·공식 지표 모음'}</span><span>정보 기준 <time dateTime={item.cutoffAt}>{kstTime(item.cutoffAt)}</time></span></div>
      <h3 className="mobile-briefing-headline"><Link to={`/briefings/${item.id}`}>{withoutCitations(item.homepage?.headline ?? item.title)}</Link></h3>
      {!!item.summary.length && <div className="mobile-briefing-summary" aria-labelledby={`${id}-summary-title`}>
        <div className="mobile-briefing-section-label"><h4 id={`${id}-summary-title`}>핵심 요약</h4><span>{state.summary ? item.summary.length : 1}/{item.summary.length}</span></div>
        <div id={`${id}-summary`}>
          <ul className="mobile-briefing-summary-list"><li><CitedText item={item} text={item.summary[0]} /></li></ul>
          <BriefingDisclosure open={state.summary} className="mobile-briefing-summary-more">
            <ul className="mobile-briefing-summary-list">{item.summary.slice(1).map((text, index) => <li key={index}><CitedText item={item} text={text} /></li>)}</ul>
          </BriefingDisclosure>
        </div>
        {item.summary.length > 1 && <button type="button" className="mobile-briefing-summary-toggle" aria-expanded={state.summary} aria-controls={`${id}-summary`} onClick={() => onChange({ ...state, summary: !state.summary })}>{state.summary ? '요약 접기' : `요약 ${item.summary.length - 1}개 더 보기`} <span aria-hidden="true">{state.summary ? '−' : '+'}</span></button>}
      </div>}
      {preview && activeSection?.key !== 'events' && <div className="mobile-briefing-event-preview">
        <div className="mobile-briefing-section-label"><h4>일정 미리보기</h4><span>발행 당시 기준</span></div>
        <time dateTime={preview.at}>{eventTime(preview.at)} KST</time>
        <p>{preview.label}<SourceRefs item={item} ids={preview.sourceIds} /></p>
      </div>}
      {!!sections.length && <div className="mobile-briefing-disclosures">
        <div className="mobile-briefing-detail-controls" role="group" aria-label="브리핑 상세 펼쳐보기">{sections.map(section => <SelectionButton key={section.key} selected={activeSection?.key === section.key} selectionId={`${id}-selection`} aria-label={`${section.label} ${section.count}개 ${activeSection?.key === section.key ? '접기' : '펼쳐보기'}`} aria-expanded={activeSection?.key === section.key} aria-controls={`${id}-details`} onClick={() => onChange({ ...state, section: activeSection?.key === section.key ? null : section.key })}>
          <span>{{ stocks: '종목', assets: '자산', events: '일정' }[section.key]} <small>{section.count}</small></span><span className="mobile-briefing-detail-symbol" aria-hidden="true">{activeSection?.key === section.key ? '−' : '+'}</span>
        </SelectionButton>)}</div>
        <BriefingDisclosure id={`${id}-details`} className="mobile-briefing-detail-content" open={!!activeSection}>
          <BriefingTransition section={activeSection?.key}>{activeSection && <BriefingDetails item={item} section={activeSection.key} mobile />}</BriefingTransition>
        </BriefingDisclosure>
      </div>}
      <p className="mobile-briefing-disclaimer">{item.reviewMode === 'automated' ? 'AI 작성·자동 검토 · ' : item.reviewMode === 'gemini-research' ? 'Gemini 요약·해석 · 자동 근거 대조 · ' : item.reviewMode === 'gemini' ? 'Gemini 제목 요약 · 자동 대조 · ' : item.reviewMode === 'rules' ? '규칙 기반 자동 정리 · AI 미사용 · ' : ''}최근 게시본 · 실시간 시황이 아닙니다.</p>
    </> : <div className="mobile-briefing-empty"><h3>브리핑을 준비하고 있습니다.</h3><p>출처와 수치를 검토한 뒤 게시합니다.</p><Link to="/#home-news-title" onClick={focusNews}>최신 뉴스 먼저 보기 ↓</Link></div>}
  </section>
}
export default function MobileDailyBriefing({ item }: { item?: Briefing }) {
  const [state, setState] = useSessionState<MobileBriefingState>(`briefing.mobile.${item?.id ?? 'empty'}`, { summary: false, section: null }, validMobileBriefingState)
  return <MobileBriefingCard item={item} state={state} onChange={setState} />
}
