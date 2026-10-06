import test from 'node:test'
import assert from 'node:assert/strict'
import { blankFields, saveThesis, parseTheses } from '../src/lib/thesis.ts'
import { emptySaved, exportSaved, importSaved, mergeSaved, removeSaved, restoreRemoved, removedItems, updateSaved } from '../src/lib/savedItems.ts'
const at='2026-10-06T02:00:00Z'
const input={ticker:'SATL',name:'Satellogic',fields:{...blankFields(),reasons:['계약의 매출 전환을 확인한다','',''],counter:'희석',next:'현금흐름',reviewDate:'2026-11-10'},baseRevision:null}
const created=saveThesis([],input,'rev1',at)
test('one note per ticker, revision conflicts and append-only judgment entries',()=>{
 const updated=saveThesis(created,{...input,baseRevision:'rev1',entry:{judgment:'pending',reason:'다음 실적을 확인'}},'rev2',at)
 const third=saveThesis(updated,{...input,baseRevision:'rev2',entry:{judgment:'strengthen',reason:'근거를 추가로 확인'}},'rev3',at)
 assert.equal(third.length,1);assert.equal(third[0].history.length,2)
 assert.deepEqual(third[0].history[0],updated[0].history[0]);assert.equal(created[0].history.length,0)
 assert.throws(()=>saveThesis(third,{...input,baseRevision:'rev1'},'rev4',at),/다른 탭/)
 assert.throws(()=>saveThesis(third,input,'rev4',at),/다른 탭/)
})
test('backup keeps notes and history, legacy imports remain compatible, duplicate notes keep existing history',()=>{
 const data={...emptySaved(),theses:created}
 assert.deepEqual(importSaved(exportSaved(data)),data)
 const legacy=JSON.stringify({app:'Anthracite',backupVersion:1,data:emptySaved()})
 assert.deepEqual(importSaved(legacy),emptySaved())
 const other=saveThesis(created,{...input,baseRevision:'rev1',entry:{judgment:'weaken',reason:'다른 기기 기록'}},'other',at)
 assert.deepEqual(mergeSaved(data,{...emptySaved(),theses:other}).theses,created)
})
test('watchlist removal and undo preserve analysis, including changes from another tab',()=>{
 const data={...emptySaved(),stocks:[{ticker:'SATL',name:'Satellogic'}],theses:created}
 const removed=removeSaved(data,'stocks',['SATL'])
 assert.deepEqual(removed.theses,created)
 const after=saveThesis(created,{...input,baseRevision:'rev1'},'rev2',at)
 assert.deepEqual(restoreRemoved({...removed,theses:after},data,removedItems(data,removed)).theses,after)
})
test('invalid imported notes and over-capacity data fail without writes',()=>{
 for(const note of [{...created[0],reviewDate:'2026-02-30'},{...created[0],reasons:['one']},{...created[0],history:[{id:'1',at,judgment:'invented',reason:'test'}]}]) assert.throws(()=>parseTheses([note]))
 assert.throws(()=>parseTheses([created[0],created[0]]))
 assert.throws(()=>parseTheses(Array.from({length:51},(_,i)=>({...created[0],ticker:`A${i}`}))))
 let writes=0
 assert.throws(()=>updateSaved({getItem:()=>JSON.stringify({...emptySaved(),theses:created}),setItem:()=>writes++},current=>({...current,theses:saveThesis(current.theses,input,'new',at)})),/다른 탭/)
 assert.equal(writes,0)
 assert.throws(()=>importSaved(JSON.stringify({app:'Anthracite',backupVersion:2,data:{...emptySaved(),theses:[{...created[0],history:'bad'}]}})))
})

test('legacy storage migrates on first write and old tabs cannot overwrite new notes',async()=>{
 const {readSaved,SAVED_KEY,LEGACY_SAVED_KEY}=await import('../src/lib/savedItems.ts')
 const legacy={...emptySaved(),stocks:[{ticker:'SATL',name:'Satellogic'}]}
 const map=new Map([[LEGACY_SAVED_KEY,JSON.stringify(legacy)]])
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}
 assert.deepEqual(readSaved(storage),legacy)
 updateSaved(storage,current=>({...current,theses:created}))
 assert.ok(map.has(SAVED_KEY))
 map.set(LEGACY_SAVED_KEY,JSON.stringify(emptySaved()))
 assert.deepEqual(readSaved(storage).theses,created)
 assert.deepEqual(readSaved(storage).stocks,legacy.stocks)
})
