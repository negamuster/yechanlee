import test from 'node:test'
import assert from 'node:assert/strict'
import { contentHash, publishable } from '../scripts/briefing-publication.mjs'
const now = Date.parse('2026-10-06T22:10:00Z')
function fixture() {
 const x={id:'2026-10-07',status:'published',title:'Briefing',sessionDate:'2026-10-06',cutoffAt:'2026-10-06T22:00:00Z',publishedAt:'2026-10-06T22:10:00Z',summary:['Verified summary [1]'],blocks:[{kind:'paragraph',text:'Verified body [1]'}],sources:[{id:1,label:'Official release',url:'https://example.org/release'}],dataNote:'Sources and times identified',corrections:[],review:{mode:'automated',approvedBy:'Anthracite automated editorial review',approvedAt:'2026-10-06T22:09:00Z',checkedSources:[1],factualReviewPassed:true,unresolvedIssues:[],sourceChecks:[{sourceId:1,verifiedUrl:'https://example.org/release',checkedAt:'2026-10-06T22:05:00Z',publishedAt:'2026-10-06T20:00:00Z',basis:'primary',claimSummary:'Verified claim and period'}]}}
 x.review.contentHash=contentHash(x);return x
}
test('automated publication requires evidence and exposes its review mode only',()=>{const x=fixture();const out=publishable([x],now);assert.equal(out[0].reviewMode,'automated');assert.equal(out[0].review,undefined);x.review.sourceChecks=[];assert.throws(()=>publishable([x],now),/evidence/)})
test('unresolved issues and missing factual review block automated publication',()=>{for(const change of [{unresolvedIssues:['Conflicting quote']},{factualReviewPassed:false}]){const x=fixture();Object.assign(x.review,change);assert.throws(()=>publishable([x],now),/incomplete/)}})
test('future evidence and source URLs outside the cited record are rejected',()=>{for(const change of [{publishedAt:'2026-10-06T22:01:00Z'},{verifiedUrl:'https://other.example/release'},{checkedAt:'2026-10-07T00:00:00Z'}]){const x=fixture();Object.assign(x.review.sourceChecks[0],change);assert.throws(()=>publishable([x],now))}})
test('unknown numbered citations cannot publish',()=>{const x=fixture();x.summary=['Unknown [2]'];x.review.contentHash=contentHash(x);assert.throws(()=>publishable([x],now),/Unknown source/)})
