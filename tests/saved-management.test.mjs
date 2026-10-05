import test from 'node:test'
import assert from 'node:assert/strict'
import { removeSaved, updateSaved } from '../src/lib/savedItems.ts'
const data = {version:1, stocks:[{ticker:'AAPL',name:'Apple'},{ticker:'MSFT',name:'Microsoft'}],articles:[{article_url:'https://example.com/1',title:'News',publisher:'Example',published_utc:'2026-10-05T00:00:00Z'}]}
test('bulk deletion only removes chosen identities from the latest stored list',()=>{
 let raw=JSON.stringify({...data,stocks:[...data.stocks,{ticker:'NVDA',name:'Nvidia'}]})
 const result=updateSaved({getItem:()=>raw,setItem:(_,v)=>{raw=v}},current=>removeSaved(current,'stocks',['AAPL','missing']))
 assert.deepEqual(result.stocks.map(s=>s.ticker),['MSFT','NVDA'])
 assert.deepEqual(result.articles,data.articles)
 assert.equal(data.stocks.length,2)
 assert.equal(removeSaved(data,'articles',['https://example.com/1']).articles.length,0)
})
test('failed storage write does not report bulk deletion success',()=>{
 assert.throws(()=>updateSaved({getItem:()=>JSON.stringify(data),setItem:()=>{throw Error('storage unavailable')}},current=>removeSaved(current,'stocks',['AAPL'])),/storage unavailable/)
})
