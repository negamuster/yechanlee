import test from 'node:test'
import assert from 'node:assert/strict'
import { SAVED_KEY, emptySaved, parseSaved, articleKey, updateSaved } from '../src/lib/savedItems.ts'
const article = { title:'Market news', publisher:'Reuters', article_url:'https://example.com/news', published_utc:'2026-01-01T00:00:00Z' }
function memory() { let raw=null; return { getItem:key=>{assert.equal(key,SAVED_KEY);return raw}, setItem:(key,value)=>{assert.equal(key,SAVED_KEY);raw=value} } }
test('persists stocks and older bookmarked articles across reloads',()=>{
 const storage=memory()
 updateSaved(storage,value=>({...value,stocks:[{ticker:'AAPL',name:'Apple'}],articles:[article]}))
 const reloaded=parseSaved(storage.getItem(SAVED_KEY))
 assert.equal(reloaded.stocks[0].ticker,'AAPL');assert.deepEqual(reloaded.articles,[article])
 updateSaved(storage,value=>({...value,stocks:[]}))
 assert.deepEqual(parseSaved(storage.getItem(SAVED_KEY)),{...emptySaved(),articles:[article]})
})
test('deduplicates identities and excludes unsafe links or malformed records',()=>{
 const parsed=parseSaved(JSON.stringify({version:1,stocks:[{ticker:'AAPL',name:'Apple'},{ticker:'AAPL',name:'Apple Inc.'},{ticker:'../bad',name:'bad'},null],articles:[article,{...article,article_url:article.article_url+'#section'},...['javascript:alert(1)','data:text/html,hi','https://user:pass@example.com'].map(article_url=>({...article,article_url})),null]}))
 assert.equal(parsed.stocks.length,1);assert.equal(parsed.articles.length,1)
 assert.equal(articleKey('javascript:alert(1)'),'')
})
test('corrupt storage is not silently overwritten and write failures do not report success',()=>{
 let writes=0
 assert.throws(()=>updateSaved({getItem:()=>'{broken',setItem:()=>writes++},()=>emptySaved()))
 assert.equal(writes,0)
 assert.throws(()=>updateSaved({getItem:()=>null,setItem:()=>{throw new Error('quota')}},()=>emptySaved()),/quota/)
 assert.throws(()=>parseSaved('{"version":2,"stocks":[],"articles":[]}'))
})
test('reads latest storage before each mutation and rejects overflow without losing previous data',()=>{
 const storage=memory()
 updateSaved(storage,value=>({...value,stocks:[{ticker:'AAPL',name:'Apple'}]}))
 updateSaved(storage,value=>({...value,articles:[article]}))
 assert.equal(parseSaved(storage.getItem(SAVED_KEY)).stocks.length,1)
 assert.throws(()=>updateSaved(storage,value=>({...value,stocks:Array.from({length:201},(_,i)=>({ticker:'T'+i,name:'Test'}))})),/limit/)
 assert.equal(parseSaved(storage.getItem(SAVED_KEY)).stocks[0].ticker,'AAPL')
})
