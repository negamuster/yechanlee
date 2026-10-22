import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEvidence } from '../src/lib/evidence.ts'
import { attachEvidence, archiveEvidence, saveThesis, parseTheses, blankFields } from '../src/lib/thesis.ts'
import { emptySaved, exportSaved, importSaved, mergeSaved, readSaved, updateSaved, SAVED_KEY, PREVIOUS_SAVED_KEY } from '../src/lib/savedItems.ts'
const at = '2026-10-22T05:00:00Z'
const source = { kind:'filing', title:'SATL Q2 filing', url:'https://www.sec.gov/Archives/filing.htm', publisher:'SEC EDGAR', publishedAt:'2026-08-14', period:'2026-04-01 ~ 2026-06-30', observedAt:at, stale:false, facts:[{label:'매출 (USD)',value:'15900000'},{label:'영업현금흐름 (USD)',value:'0'}], links:[{label:'10-Q',url:'https://www.sec.gov/Archives/source.htm'}], caveat:'공시 기준' }
const evidence = (overrides={}) => ({...structuredClone(source),id:'ev1',attachedAt:at,role:'support',reason:'다음 분기 매출 전환을 확인',...overrides})
const attach = (notes=[], e=evidence()) => attachEvidence(notes,{ticker:'SATL',name:'Satellogic',evidence:e},'new-note').notes
test('attachments freeze source values and preserve in-progress prose revisions, including the first unsaved draft', () => {
  const raw=evidence(), notes=attach([],raw)
  raw.facts[0].value='999'; raw.links[0].url='https://changed.test'
  assert.equal(notes[0].evidence[0].facts[0].value,'15900000')
  const saved=saveThesis(notes,{ticker:'SATL',name:'Satellogic',fields:{...blankFields(),reasons:['My unsaved draft','','']},baseRevision:null},'prose-1',at)
  const withMore=attach(saved,evidence({id:'ev2',facts:[{label:'매출 (USD)',value:'17000000'}]}))
  assert.equal(withMore[0].revision,'prose-1')
  const final=saveThesis(withMore,{ticker:'SATL',name:'Satellogic',fields:{...blankFields(),next:'Preserved draft'},baseRevision:'prose-1'},'prose-2',at)
  assert.equal(final[0].evidence.length,2); assert.equal(final[0].next,'Preserved draft')
  assert.throws(()=>saveThesis(final,{ticker:'SATL',name:'Satellogic',fields:blankFields(),baseRevision:null},'bad',at),/다른 탭/)
})
test('judgment references remain exact after new source versions and archiving; duplicate attachments restore the original', () => {
  const first=attach()
  const judged=saveThesis(first,{ticker:'SATL',name:'Satellogic',fields:blankFields(),baseRevision:first[0].revision,entry:{judgment:'maintain',reason:'Original basis',evidenceIds:['ev1']}},'judgment-1',at)
  const archived=archiveEvidence(judged,'SATL','ev1',at,true), withNew=attach(archived,evidence({id:'ev2',facts:[{label:'매출 (USD)',value:'20000000'}]}))
  assert.deepEqual(withNew[0].history[0].evidenceIds,['ev1']);assert.equal(withNew[0].evidence[0].facts[0].value,'15900000')
  assert.ok(withNew[0].evidence[0].archivedAt)
  const restored=attachEvidence(withNew,{ticker:'SATL',name:'Satellogic',evidence:evidence({id:'ev3',attachedAt:'2026-10-23T00:00:00Z'})},'ignored')
  assert.equal(restored.id,'ev1');assert.equal(restored.notes[0].evidence.length,2);assert.equal(restored.notes[0].evidence[0].archivedAt,undefined)
  assert.equal(restored.notes[0].evidence[0].attachedAt,at)
  assert.deepEqual(judged[0].history,withNew[0].history)
  assert.throws(()=>saveThesis(archived,{ticker:'SATL',name:'Satellogic',fields:blankFields(),baseRevision:'judgment-1',entry:{judgment:'weaken',reason:'Archived',evidenceIds:['ev1']}},'bad',at),/보관/)
})
test('invalid sources, duplicate IDs, dangling references and quota failures reject an entire write', () => {
  for(const bad of [{url:'javascript:alert(1)'},{links:[{label:'bad',url:'data:text/html,bad'}]},{url:'https://user:secret@example.com'},{facts:[{label:'bad',value:5}]},{id:3},{role:'buy'},{publishedAt:'2026-02-30'},{attachedAt:'2026-02-30T00:00:00Z'},{facts:Array(25).fill({label:'x',value:'y'})}]) assert.throws(()=>parseEvidence([evidence(bad)]))
  assert.throws(()=>parseEvidence([evidence(),evidence()]))
  assert.throws(()=>parseEvidence(Array.from({length:101},(_,i)=>evidence({id:`e${i}`}))))
  const notes=attach()
  assert.throws(()=>parseTheses([{...notes[0],history:[{id:'j',at,judgment:'pending',reason:'x',evidenceIds:['missing']}]}]))
  let writes=0
  assert.throws(()=>updateSaved({getItem:()=>JSON.stringify({...emptySaved(),theses:notes}),setItem:()=>{writes++;throw Error('quota')}},current=>({...current,theses:attach(current.theses,evidence({id:'new',reason:'Another annotation'}))})),/quota/)
  assert.equal(writes,1);assert.equal(notes[0].evidence.length,1)
})
test('new backup keeps evidence and judgment references; v1/v2 import and v2 storage migration remain safe', () => {
  let notes=attach();notes=saveThesis(notes,{ticker:'SATL',name:'Satellogic',fields:blankFields(),baseRevision:notes[0].revision,entry:{judgment:'pending',reason:'Watch',evidenceIds:['ev1']}},'j',at)
  const data={...emptySaved(),theses:notes}, encoded=exportSaved(data)
  assert.equal(JSON.parse(encoded).backupVersion,3);assert.deepEqual(importSaved(encoded),data)
  for(const v of [1,2])assert.deepEqual(importSaved(JSON.stringify({app:'Anthracite',backupVersion:v,data:emptySaved()})),emptySaved())
  const map=new Map([[PREVIOUS_SAVED_KEY,JSON.stringify({...emptySaved(),stocks:[{ticker:'SATL',name:'Satellogic'}]})]])
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
  updateSaved(storage,current=>({...current,theses:notes}));assert.ok(map.has(SAVED_KEY))
  map.set(PREVIOUS_SAVED_KEY,JSON.stringify(emptySaved()));assert.deepEqual(readSaved(storage).theses,notes)
})
test('same-ticker backup merge preserves prose and history, adds evidence, and stops conflicting snapshot IDs', () => {
  const notes=attach(), current={...emptySaved(),theses:notes}
  const imported={...emptySaved(),theses:attach([],evidence({id:'ev2',reason:'Other device'}))}
  const merged=mergeSaved(current,imported)
  assert.equal(merged.theses[0].evidence.length,2);assert.equal(merged.theses[0].revision,notes[0].revision)
  assert.throws(()=>mergeSaved(current,{...emptySaved(),theses:attach([],evidence({facts:[{label:'Changed',value:'999'}]}))}),/식별자/)
})
test('large valid collections export a compact self-importable backup when indentation exceeds the import limit',()=>{
  const note=attach()[0], facts=Array.from({length:24},(_,i)=>({label:`m${i}`,value:'x'.repeat(40)}))
  const data={...emptySaved(),theses:Array.from({length:18},(_,i)=>({...note,ticker:`N${i}`,evidence:Array.from({length:100},(_,j)=>evidence({id:`e${j}`,facts}))}))}
  assert.ok(Buffer.byteLength(JSON.stringify(data))<4*1024*1024)
  const readable=JSON.stringify({app:'Anthracite',backupVersion:3,data},null,2)
  assert.ok(Buffer.byteLength(readable)>5*1024*1024)
  const encoded=exportSaved(data)
  assert.ok(Buffer.byteLength(encoded)<5*1024*1024);assert.deepEqual(importSaved(encoded),data)
})
