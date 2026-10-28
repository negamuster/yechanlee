import { Info, RefreshCw, X } from 'lucide-react'
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
      <RefreshCw aria-hidden="true" focusable="false" strokeWidth={1.8} />
    </button>}
    {info && <button type="button" className="widget-action" data-widget-action="info"
      aria-label={info.label} title={info.label} aria-expanded={info.open} aria-controls={info.id}
      disabled={info.disabled} onClick={info.onClick}>
      <Info aria-hidden="true" focusable="false" strokeWidth={1.8} />
    </button>}
    {close && <button type="button" className="widget-action" data-widget-action="close" aria-label="영상 닫기" title="영상 닫기" onClick={close}>
      <X aria-hidden="true" focusable="false" strokeWidth={1.8} />
    </button>}
  </div>
}
