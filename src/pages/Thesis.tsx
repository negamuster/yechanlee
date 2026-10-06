import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSavedItems } from '../components/SavedItemsProvider'
import { blankFields, validFields, JUDGMENTS } from '../lib/thesis'
import type { ThesisFields, Judgment } from '../lib/thesis'
import './Thesis.css'
type Draft = { fields:ThesisFields; baseRevision:string|null; judgment:Judgment; reason:string }
const memoryDrafts = new Map<string, Draft>()
function Editor({ticker}:{ticker:string}) {
  const {items,saveNote}=useSavedItems()
  const note=items.theses?.find(n=>n.ticker===ticker)
  const stock=items.stocks.find(s=>s.ticker===ticker)
  const key=`anthracite:thesis-draft:${ticker}`
  const [draft,setDraft]=useState<Draft>(()=>{
    if(memoryDrafts.has(key)) return memoryDrafts.get(key)!
    try { const d=JSON.parse(sessionStorage.getItem(key)||'null'); if(d && validFields(d.fields) && (d.baseRevision===null||typeof d.baseRevision==='string') && Object.hasOwn(JUDGMENTS,d.judgment) && typeof d.reason==='string' && d.reason.length<=1000) return d } catch { /* Start with saved note. */ }
    return {fields:note ? {reasons:[...note.reasons],counter:note.counter,next:note.next,reviewDate:note.reviewDate}:blankFields(),baseRevision:note?.revision||null,judgment:'pending',reason:''}
  })
  const [status,setStatus]=useState('작성 중인 초안은 노트 저장 후 백업에 포함됩니다.')
  const [error,setError]=useState('')
  const [unprotected,setUnprotected]=useState(() => { try { return memoryDrafts.has(key) && JSON.stringify(memoryDrafts.get(key)) !== sessionStorage.getItem(key) } catch { return memoryDrafts.has(key) } })
  const [discard,setDiscard]=useState(false)
  useEffect(()=>{
    function warn(e:BeforeUnloadEvent){if(unprotected){e.preventDefault();e.returnValue=''}}
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)
  },[unprotected])
  function edit(next:Draft){
    memoryDrafts.set(key,next);setDraft(next);setError('');setDiscard(false)
    try{sessionStorage.setItem(key,JSON.stringify(next));setStatus('초안을 이 탭에 임시저장했습니다.');setUnprotected(false)}catch{setStatus('');setUnprotected(true);setError('초안을 임시저장하지 못했습니다. 페이지를 떠나기 전에 노트를 저장하거나 내용을 복사해 주세요.')}
  }
  function field(name:'counter'|'next'|'reviewDate',value:string){edit({...draft,fields:{...draft.fields,[name]:value}})}
  function save(withEntry:boolean){
    setError('')
    if(!draft.fields.reasons.some(r=>r.trim())&&!draft.fields.counter.trim()&&!draft.fields.next.trim()){setError('투자 근거·반대 근거·다음 확인 사항 중 하나 이상을 작성해 주세요.');return}
    if(withEntry&&!draft.reason.trim()){setError('판단 이유를 입력해 주세요.');return}
    try{
      const revision=saveNote({ticker,name:stock?.name||note?.name||ticker,fields:draft.fields,baseRevision:draft.baseRevision,...(withEntry?{entry:{judgment:draft.judgment,reason:draft.reason.trim()}}:{})})
      const next={...draft,baseRevision:revision,reason:withEntry?'':draft.reason}
      memoryDrafts.set(key,next);setDraft(next);setDiscard(false);setUnprotected(false);setStatus(withEntry?'노트와 판단 기록을 저장했습니다.':'노트를 저장했습니다.')
      try{sessionStorage.setItem(key,JSON.stringify(next))}catch{setStatus('노트는 저장했습니다. 작성 중인 판단 이유는 임시저장하지 못했으니 복사해 두세요.');setUnprotected(!!next.reason)}
    }catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')}
  }
  function reset(){
    try{sessionStorage.removeItem(key)}catch{setError('초안을 지우지 못했습니다. 브라우저 저장 설정을 확인해 주세요.');return}
    memoryDrafts.delete(key)
    setDraft({fields:note?{reasons:[...note.reasons],counter:note.counter,next:note.next,reviewDate:note.reviewDate}:blankFields(),baseRevision:note?.revision||null,judgment:'pending',reason:''});setDiscard(false);setStatus('저장된 노트로 되돌렸습니다.');setError('');setUnprotected(false)
  }
  return <main className="thesis-page"><Link to="/saved">← 저장한 항목</Link><header><p className="thesis-eyebrow">THESIS TRACKER</p><h1>{ticker} <span>투자 노트</span></h1><p>{stock?.name||note?.name||ticker}</p></header>
    <p className="thesis-help">브라우저에 저장되는 개인 분석 기록입니다. 작성 중인 초안은 이 탭에서 유지되며, 탭을 닫으면 사라질 수 있습니다. ‘노트 저장’을 누르면 백업에도 포함됩니다.</p>
    {!stock&&!note?<p>먼저 <Link to="/saved">관심 종목을 저장</Link>해 주세요.</p>:<>
    {note&&<p className="thesis-help">마지막 저장 {new Date(note.updatedAt).toLocaleString('ko-KR')} · 판단 기록 {note.history.length}/100개</p>}
    {(note?.revision||null)!==draft.baseRevision&&<p className="thesis-error" role="alert">다른 탭에서 노트가 변경되었습니다. 작성 중인 내용을 복사한 뒤 초안 취소를 눌러 최신 저장 내용으로 돌아가세요.</p>}
    <form onSubmit={e=>{e.preventDefault();save(false)}}>
      <fieldset><legend>투자 근거 <small>최대 3개</small></legend>{draft.fields.reasons.map((reason,index)=><label key={index}>근거 {index+1}<textarea maxLength={2000} rows={3} value={reason} placeholder="이 기업을 보는 이유와 확인 가능한 근거" onChange={e=>{const reasons=[...draft.fields.reasons] as ThesisFields['reasons'];reasons[index]=e.target.value;edit({...draft,fields:{...draft.fields,reasons}})}} /></label>)}</fieldset>
      <label>반대 근거<textarea maxLength={2000} rows={4} value={draft.fields.counter} placeholder="내 판단이 틀릴 수 있는 이유" onChange={e=>field('counter',e.target.value)}/></label>
      <label>다음 확인 사항<textarea maxLength={2000} rows={4} value={draft.fields.next} placeholder="다음 실적·공시에서 확인할 질문" onChange={e=>field('next',e.target.value)}/></label>
      <label>확인 예정일 <small>선택 입력 · 알림은 전송되지 않습니다.</small><input type="date" value={draft.fields.reviewDate} onChange={e=>field('reviewDate',e.target.value)}/></label>
      <div className="thesis-actions"><button type="submit">노트 저장</button><button type="button" onClick={()=>setDiscard(true)}>초안 취소</button></div>
      {discard&&<div className="thesis-confirm">작성 중인 변경을 버리고 마지막 저장 내용으로 돌아갈까요?<button type="button" onClick={reset}>변경 버리기</button><button type="button" onClick={()=>setDiscard(false)}>계속 작성</button></div>}
      <p className="thesis-status" role="status">{status}</p>{error&&<p className="thesis-error" role="alert">{error}</p>}
      <section className="thesis-judgment"><h2>판단 기록 추가</h2><p className="thesis-help">선택한 판단과 이유가 날짜순으로 쌓입니다. 기존 판단 기록은 덮어쓰지 않습니다.</p><label>판단<select value={draft.judgment} onChange={e=>edit({...draft,judgment:e.target.value as Judgment})}>{Object.entries(JUDGMENTS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>판단 이유<textarea rows={3} maxLength={1000} value={draft.reason} onChange={e=>edit({...draft,reason:e.target.value})} placeholder="어떤 근거로 생각이 바뀌었는지 적어 주세요."/></label><button type="button" disabled={(note?.history.length||0)>=100} onClick={()=>save(true)}>노트 저장 · 판단 기록 추가</button></section>
    </form>
    <section><h2>판단 변경 이력</h2>{note?.history.length?<ol className="thesis-history">{[...note.history].reverse().map(h=><li key={h.id}><strong>{JUDGMENTS[h.judgment]}</strong><time dateTime={h.at}>{new Date(h.at).toLocaleString('ko-KR')}</time><p>{h.reason}</p></li>)}</ol>:<p className="thesis-help">아직 판단 기록이 없습니다.</p>}</section>
    </>}
  </main>
}
export default function ThesisPage(){const {ticker=''}=useParams();return /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(ticker)?<Editor key={ticker} ticker={ticker}/>:<main className="thesis-page"><p>올바르지 않은 종목입니다.</p><Link to="/saved">저장한 항목으로</Link></main>}
