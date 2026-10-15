import './WidgetActions.css'

export default function WidgetActions({ label, refresh, info, close }: {
  label: string
  refresh?: { loading: boolean; onClick: () => void }
  info?: { id: string; label: string; open: boolean; onClick: () => void; disabled?: boolean }
  close?: () => void
}) {
  return <div className="widget-actions">
    {refresh && <button type="button" className="widget-action" data-widget-action="refresh"
      aria-label={`${label} 새로고침${refresh.loading ? ' 중' : ''}`} title={`${label} 새로고침`}
      disabled={refresh.loading} onClick={refresh.onClick}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
    </button>}
    {info && <button type="button" className="widget-action" data-widget-action="info"
      aria-label={info.label} title={info.label} aria-expanded={info.open} aria-controls={info.id}
      disabled={info.disabled} onClick={info.onClick}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>
    </button>}
    {close && <button type="button" className="widget-action" data-widget-action="close" aria-label="영상 닫기" title="영상 닫기" onClick={close}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </button>}
  </div>
}
