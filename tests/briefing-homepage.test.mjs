import test from 'node:test'
import assert from 'node:assert/strict'
import { contentHash, publishable } from '../scripts/briefing-publication.mjs'
import { validateBriefingHomepage } from '../scripts/briefing-homepage.mjs'
const fixture = () => {
  const x = { id:'2026-10-06', status:'published', title:'Title', sessionDate:'2026-10-05', cutoffAt:'2026-10-06T00:00:00Z', publishedAt:'2026-10-06T01:00:00Z', summary:['Fact[1]'], blocks:[{kind:'paragraph',text:'Fact[1]'}], sources:[{id:1,label:'Official',url:'https://www.bls.gov/'}], dataNote:'Observed data', corrections:[], review:{approvedBy:'Editor',approvedAt:'2026-10-06T00:30:00Z',checkedSources:[1]}, homepage:{headline:'Theme[1]',stocks:[{name:'Company',ticker:'ABC',change:'−1%',reason:'Reported result',basis:'Prior session close',sourceIds:[1]}],assets:[{label:'Yield',value:'4%',change:'−1bp',basis:'Official observation',sourceIds:[1]}],events:[{at:'2026-10-06T12:00:00+09:00',label:'Release',sourceIds:[1]}]} }
  x.review.contentHash=contentHash(x)
  return x
}
test('reviewed homepage reaches public output, with review records excluded', () => {
  const x=fixture(), [publicItem]=publishable([x],Date.parse('2026-10-06T02:00:00Z'))
  assert.deepEqual(publicItem.homepage,x.homepage)
  assert.equal(publicItem.review,undefined)
  x.homepage.assets[0].value='5%'
  assert.throws(()=>publishable([x]),/Unreviewed/)
})
test('unknown and missing citations block homepage publication', () => {
  for (const change of [x=>x.homepage.stocks[0].sourceIds=[2],x=>x.homepage.assets[0].sourceIds=[],x=>x.homepage.headline='Unsupported',x=>x.homepage.events[0].detail='Unknown[9]']) {
    const x=fixture();change(x);assert.throws(()=>validateBriefingHomepage(x),/Invalid/)
  }
})
test('events require a timezone and fall after cutoff within the 72-hour window', () => {
  for (const at of ['2026-10-06T12:00:00','2026-10-06T00:00:00Z','2026-10-09T00:00:01Z','invalid']) {
    const x=fixture();x.homepage.events[0].at=at;assert.throws(()=>validateBriefingHomepage(x),/Invalid/)
  }
})
test('unavailable sections may be empty but oversized sections cannot be published', () => {
  const x=fixture();x.homepage.stocks=[];x.homepage.assets=[];x.homepage.events=[]
  assert.doesNotThrow(()=>validateBriefingHomepage(x))
  const y=fixture();y.homepage.stocks=Array(5).fill(y.homepage.stocks[0]);assert.throws(()=>validateBriefingHomepage(y),/Invalid/)
})
test('older editions retain compatibility; new automated editions require homepage fields', () => {
  const x=fixture();delete x.homepage;assert.doesNotThrow(()=>validateBriefingHomepage(x))
  x.id='2026-10-15';x.review.mode='automated';assert.throws(()=>validateBriefingHomepage(x),/Missing/)
  x.review.mode='rules';assert.doesNotThrow(()=>validateBriefingHomepage(x))
})
