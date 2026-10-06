import test from 'node:test'
import assert from 'node:assert/strict'
import { contentHash, publishable } from '../scripts/briefing-publication.mjs'
const now = Date.parse('2026-10-06T12:00:00Z')
const fixture = () => {
 const x={id:'2026-10-06',status:'published',title:'Title',sessionDate:'2026-10-05',cutoffAt:'2026-10-06T07:00:00Z',publishedAt:'2026-10-06T10:00:00Z',summary:['Summary'],blocks:[{kind:'paragraph',text:'Body'}],sources:[{id:1,label:'Fed',url:'https://www.federalreserve.gov/'}],dataNote:'Reported prices',corrections:[],review:{approvedBy:'Editor',approvedAt:'2026-10-06T09:00:00Z',checkedSources:[1]}}
 x.review.contentHash=contentHash(x); return x
}
test('draft text and review fields never enter public payload',()=>{
 const x=fixture();assert.deepEqual(publishable([{...x,status:'draft'}],now),[])
 x.internalNotes='Private working note';x.review.contentHash=contentHash(x);const [publicItem]=publishable([x],now);assert.equal(publicItem.internalNotes,undefined);assert.equal(publicItem.review,undefined);assert.equal(publicItem.status,undefined)
})
test('changed approved text and unchecked sources stop publication',()=>{
 const x=fixture();x.title='Changed';assert.throws(()=>publishable([x],now),/Unreviewed/)
 const y=fixture();y.review.checkedSources=[];assert.throws(()=>publishable([y],now),/Unchecked/)
})
test('future publication and invalid approval sequence fail',()=>{
 const x=fixture();assert.throws(()=>publishable([x],Date.parse(x.cutoffAt)),/times/)
 x.review.approvedAt='2026-10-06T06:00:00Z';assert.throws(()=>publishable([x],now),/times/)
})
test('duplicate dates and insecure sources fail',()=>{
 const x=fixture();assert.throws(()=>publishable([x,x],now),/duplicate/)
 x.sources[0].url='javascript:alert(1)';x.review.contentHash=contentHash(x);assert.throws(()=>publishable([x],now),/source/)
})
