import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySaved, exportSaved, importSaved, mergeSaved, updateSaved } from '../src/lib/savedItems.ts'
const a={ticker:'AAPL',name:'Apple'}
const article={title:'Market news',publisher:'Example',article_url:'https://example.com/news',published_utc:'2026-10-01T00:00:00Z'}
const saved={version:1,stocks:[a],articles:[article]}
test('backup round trip keeps names, order and bookmark metadata',()=>{
 assert.deepEqual(importSaved(exportSaved(saved)),saved)
 assert.deepEqual(importSaved(exportSaved(emptySaved())),emptySaved())
})
test('merge preserves existing data and ignores duplicate identities including URL fragments',()=>{
 const incoming=importSaved(exportSaved({version:1,stocks:[{...a,name:'Changed'},{ticker:'MSFT',name:'Microsoft'}],articles:[{...article,article_url:article.article_url+'#part'}]}))
 const merged=mergeSaved(saved,incoming)
 assert.deepEqual(merged.stocks,[a,{ticker:'MSFT',name:'Microsoft'}]);assert.deepEqual(merged.articles,[article]);assert.equal(saved.stocks.length,1)
})
test('malformed, unsafe, oversized and unsupported imports reject the whole file',()=>{
 for(const text of ['bad','{}',exportSaved(saved).replace('"backupVersion": 2','"backupVersion": 999'),exportSaved(saved).replace('https://example.com/news','javascript:alert(1)'),exportSaved(saved).replace('AAPL','../oops'),' '.repeat(5*1024*1024+1)]) assert.throws(()=>importSaved(text))
})
test('merged capacity overflow does not write or discard existing entries',()=>{
 const current={version:1,stocks:Array.from({length:200},(_,i)=>({ticker:'T'+i,name:'Test'})),articles:[]};let writes=0
 assert.throws(()=>updateSaved({getItem:()=>JSON.stringify(current),setItem:()=>writes++},value=>mergeSaved(value,saved)),/한도/)
 assert.equal(writes,0)
})
