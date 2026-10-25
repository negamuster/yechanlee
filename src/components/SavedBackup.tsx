import { useEffect, useRef, useState } from 'react'
import { useSavedItems } from '../hooks/useSavedItems'
import { readSaved, exportSaved, importSaved, mergeSaved } from '../lib/savedItems'
import type { SavedItems } from '../lib/savedItems'
import { BACKUP_STATUS_KEY, backupComparison, readBackupRequest, savedDigest } from '../lib/backupStatus'
import type { BackupRequest } from '../lib/backupStatus'
import './SavedBackup.css'

export default function SavedBackup() {
  const { items, mergeBackup } = useSavedItems()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SavedItems | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [statusWarning, setStatusWarning] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [requestStatus, setRequestStatus] = useState<{ items?: SavedItems; refresh?: number; request: BackupRequest | null; comparison: ReturnType<typeof backupComparison> | 'checking' }>({ request: null, comparison: 'checking' })
  useEffect(() => {
    function sync(event: StorageEvent) { if (event.key === BACKUP_STATUS_KEY || event.key === null) setRefresh(n => n + 1) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    let cancelled = false
    async function check() {
      let request: BackupRequest | null = null
      try {
        request = readBackupRequest(localStorage)
        const digest = request ? await savedDigest(readSaved(localStorage)) : null
        if (!cancelled) setRequestStatus({ items, refresh, request, comparison: backupComparison(request, digest) })
      } catch { if (!cancelled) setRequestStatus({ items, refresh, request, comparison: 'unknown' }) }
    }
    void check()
    return () => { cancelled = true }
  }, [items, refresh])
  let preview = '', limitError = ''
  if (pending) {
    try {
      const merged = mergeSaved(items, pending)
      preview = `새 종목 ${merged.stocks.length - items.stocks.length}개 · 새 기사 ${merged.articles.length - items.articles.length}개 · 새 투자 노트 ${(merged.theses?.length || 0) - (items.theses?.length || 0)}개를 추가합니다. 중복 노트는 기존 내용·판단 이력을 유지하며 새 근거 자료만 추가합니다.`
    } catch (e) { limitError = (e as Error).message }
  }
  async function download() {
    setBusy(true); setError(''); setMessage(''); setStatusWarning('')
    try {
      const current = readSaved(localStorage)
      const at = new Date(), serialized = exportSaved(current, at)
      let digest: string | null = null
      try { digest = await savedDigest(current) } catch { /* A comparison failure must not prevent export. */ }
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `anthracite-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      document.body.append(anchor)
      try { anchor.click() } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
      setMessage('백업 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.')
      try {
        localStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify({ version: 1, requestedAt: new Date().toISOString(), digest }))
        if (!digest) setStatusWarning('내보내기는 요청했지만 저장 내용의 변경 여부를 비교할 수 없습니다.')
      } catch { setStatusWarning('내보내기는 요청했지만 요청 기록을 저장하지 못했습니다. 표시된 상태는 이전 기록일 수 있습니다.') }
      setRefresh(n => n + 1)
    } catch { setError('백업을 만들지 못했습니다. 브라우저 저장 공간과 다운로드 설정을 확인해 주세요.') }
    finally { setBusy(false) }
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
  const comparison = requestStatus.items === items && requestStatus.refresh === refresh ? requestStatus.comparison : 'checking'
  const statusText = { checking: '저장 내용과 내보내기 요청 기록을 확인 중입니다.', none: '이 브라우저에 내보내기 요청 기록이 없습니다.', same: '현재 저장 내용은 마지막 내보내기 요청 파일에 포함한 내용과 같습니다.', changed: '마지막 내보내기 요청 이후 저장 내용이 달라졌습니다.', unknown: '내보내기 요청 기록 또는 저장 내용의 변경 여부를 확인할 수 없습니다.' }[comparison]
  return <section className="saved-backup-area" aria-label="백업 상태">
    <div className="saved-backup-status" role="status"><strong>{statusText}</strong>{requestStatus.request && <span>마지막 내보내기 요청: {new Date(requestStatus.request.requestedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} KST</span>}</div>
    <p className="saved-note">이 브라우저의 요청 기록입니다. 실제 파일 저장 완료는 다운로드 목록에서 확인하세요. 작성 중인 초안은 노트 저장 전까지 백업에 포함되지 않습니다.</p>
    {statusWarning && <p className="saved-backup-error" role="alert">{statusWarning}</p>}
    <details className="saved-backup"><summary>백업 · 다른 기기로 옮기기</summary>
    <p>종목·기사 북마크·저장된 투자 노트를 파일로 저장해 다른 기기에서 불러올 수 있습니다. 파일은 이 브라우저에서 처리되며 서버에 업로드하지 않습니다. 작성 중인 초안은 제외됩니다. 노트와 연결된 근거 자료·수치·출처를 함께 저장합니다. 같은 종목의 노트는 기존 내용·판단 이력을 유지하고 새 근거 자료만 추가합니다.</p>
    <div className="saved-backup-actions"><button type="button" onClick={() => { void download() }} disabled={busy}>백업 내보내기</button><button type="button" onClick={() => input.current?.click()} disabled={busy}>백업 불러오기</button><input ref={input} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file) }} /></div>
    {busy && <p role="status">백업 파일을 처리하고 있습니다…</p>}
    {pending && <div className="saved-backup-preview"><strong>불러올 파일: 종목 {pending.stocks.length}개 · 기사 {pending.articles.length}개 · 투자 노트 {pending.theses?.length || 0}개</strong><p>{limitError || preview}</p><div className="saved-backup-actions"><button type="button" disabled={!!limitError} onClick={apply}>기존 목록에 합치기</button><button type="button" onClick={() => { setPending(null); setError('') }}>취소</button></div></div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="saved-backup-error">{error}</p>}
  </details></section>
}
