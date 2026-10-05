import { useRef, useState } from 'react'
import { useSavedItems } from './SavedItemsProvider'
import { SAVED_KEY, parseSaved, exportSaved, importSaved, mergeSaved } from '../lib/savedItems'
import type { SavedItems } from '../lib/savedItems'
import './SavedBackup.css'

export default function SavedBackup() {
  const { items, mergeBackup } = useSavedItems()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SavedItems | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  let preview = '', limitError = ''
  if (pending) {
    try {
      const merged = mergeSaved(items, pending)
      preview = `새 종목 ${merged.stocks.length - items.stocks.length}개 · 새 기사 ${merged.articles.length - items.articles.length}개를 추가합니다. 중복 항목은 기존 내용을 유지합니다.`
    } catch (e) { limitError = (e as Error).message }
  }
  function download() {
    setError(''); setMessage('')
    try {
      const current = parseSaved(localStorage.getItem(SAVED_KEY))
      const blob = new Blob([exportSaved(current)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `anthracite-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      document.body.append(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('백업 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.')
    } catch { setError('백업을 만들지 못했습니다. 브라우저 저장 공간과 다운로드 설정을 확인해 주세요.') }
  }
  async function readFile(file: File) {
    setBusy(true); setPending(null); setError(''); setMessage('')
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('백업 파일은 5MB 이하만 불러올 수 있습니다.')
      setPending(importSaved(await file.text()))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  function apply() {
    if (!pending) return
    try {
      mergeBackup(pending)
      setPending(null); setError(''); setMessage('백업을 기존 목록에 합쳤습니다.')
    } catch (e) {
      setError((e as Error).message.includes('한도') ? (e as Error).message : '목록을 저장하지 못했습니다. 기존 목록은 유지됩니다. 브라우저 저장 설정과 여유 공간을 확인해 주세요.')
    }
  }
  return <details className="saved-backup"><summary>백업 · 다른 기기로 옮기기</summary>
    <p>종목과 기사 북마크를 파일로 저장해 다른 기기에서 불러올 수 있습니다. 파일은 이 브라우저에서 처리되며 서버에 업로드하지 않습니다.</p>
    <div className="saved-backup-actions"><button type="button" onClick={download} disabled={busy}>백업 내보내기</button><button type="button" onClick={() => input.current?.click()} disabled={busy}>{busy ? '파일 확인 중…' : '백업 불러오기'}</button><input ref={input} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file) }} /></div>
    {pending && <div className="saved-backup-preview"><strong>불러올 파일: 종목 {pending.stocks.length}개 · 기사 {pending.articles.length}개</strong><p>{limitError || preview}</p><div className="saved-backup-actions"><button type="button" disabled={!!limitError} onClick={apply}>기존 목록에 합치기</button><button type="button" onClick={() => { setPending(null); setError('') }}>취소</button></div></div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="saved-backup-error">{error}</p>}
  </details>
}
