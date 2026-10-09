import test from 'node:test'
import assert from 'node:assert/strict'
import {applyClaimPatches,draftClaims,auditIssues} from '../scripts/briefing-review.mjs'
const claim={text:'원문에 근거한 문장입니다.',evidence:['s1p1']}
const draft={sections:[{title:'주요 변화 분석',facts:claim,change:null,interpretation:claim,watch:claim}]}
test('targeted patches cannot change accepted claims, sections, or duplicate claims',()=>{
 const issues=[{claimId:'section-1.facts'}],replacement={text:'거절 사유를 고친 문장입니다.',evidence:['s1p1']}
 const changed=applyClaimPatches(draft,issues,{patches:[{claimId:'section-1.facts',replacement}]})
 assert.deepEqual(changed.sections[0].watch,draft.sections[0].watch)
 assert.equal(changed.sections[0].facts.text,replacement.text)
 assert.equal(draft.sections[0].facts.text,claim.text)
 for(const patches of [[{claimId:'section-1.watch',replacement}],[{claimId:'section-2.facts',replacement}],[{claimId:'section-1.facts',replacement},{claimId:'section-1.facts',replacement}]])assert.throws(()=>applyClaimPatches(draft,issues,{patches}),/research_patch/)
})
test('audit issues require an actual claim, category and valid evidence',()=>{
 const catalog=[{paragraphs:[{id:'s1p1'}]}],issue={claimId:'section-1.facts',category:'unit',reason:'단위가 다릅니다.',evidence:['s1p1']}
 const verdict={approved:false,issues:[issue],checkedParagraphIds:['s1p1']}
 assert.equal(auditIssues(verdict,draft,catalog,['s1p1'])[0].text,claim.text)
 assert.throws(()=>auditIssues({...verdict,issues:[{...issue,claimId:'section-9.facts'}]},draft,catalog,['s1p1']))
 assert.throws(()=>auditIssues({...verdict,approved:true},draft,catalog,['s1p1']))
 assert.equal(draftClaims(draft).length,4)
})
