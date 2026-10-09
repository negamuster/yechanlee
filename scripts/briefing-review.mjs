export const REVIEW_CATEGORIES=['unsupported','attribution','meaning','unit','date','number','other']
const fields=['title','facts','change','interpretation','watch']
const uniq=a=>[...new Set(a)]
export function draftClaims(output) {
  return output.sections.flatMap((s,i)=>fields.flatMap(field=>{
    const c=s[field];if(c===null)return []
    const evidence=field==='title'?uniq(fields.slice(1).flatMap(f=>s[f]?.evidence||[])):c.evidence
    return [{claimId:`section-${i+1}.${field}`,text:field==='title'?c:c.text,evidence}]
  }))
}
export function auditSchema(output,paragraphIds) {
 return {type:'OBJECT',properties:{approved:{type:'BOOLEAN'},issues:{type:'ARRAY',items:{type:'OBJECT',properties:{claimId:{type:'STRING',enum:draftClaims(output).map(c=>c.claimId)},category:{type:'STRING',enum:REVIEW_CATEGORIES},reason:{type:'STRING'},evidence:{type:'ARRAY',items:{type:'STRING',enum:paragraphIds}}},required:['claimId','category','reason','evidence']}},checkedParagraphIds:{type:'ARRAY',items:{type:'STRING',enum:paragraphIds}}},required:['approved','issues','checkedParagraphIds']}
}
export function auditIssues(verdict,output,catalog,used) {
 const records=draftClaims(output),ids=new Set(catalog.flatMap(d=>d.paragraphs.map(p=>p.id)))
 if(typeof verdict?.approved!=='boolean'||!Array.isArray(verdict.issues)||verdict.issues.length>20||!Array.isArray(verdict.checkedParagraphIds)||JSON.stringify([...verdict.checkedParagraphIds].sort())!==JSON.stringify([...used].sort()))throw Error('research_audit_format')
 if(verdict.approved!==(verdict.issues.length===0))throw Error('research_audit_format')
 return verdict.issues.map(issue=>{
  const claim=records.find(c=>c.claimId===issue.claimId)
  if(!claim||!REVIEW_CATEGORIES.includes(issue.category)||typeof issue.reason!=='string'||!issue.reason.trim()||issue.reason.length>1000||!Array.isArray(issue.evidence)||!issue.evidence.length||issue.evidence.some(id=>!ids.has(id)))throw Error('research_audit_format')
  return {...issue,text:claim.text,citedEvidence:claim.evidence}
 })
}
const replacement={type:'OBJECT',nullable:true,properties:{text:{type:'STRING'},evidence:{type:'ARRAY',items:{type:'STRING'}}},required:['text','evidence']}
export const patchSchema={type:'OBJECT',properties:{patches:{type:'ARRAY',items:{type:'OBJECT',properties:{claimId:{type:'STRING'},replacement},required:['claimId','replacement']}}},required:['patches']}
export function applyClaimPatches(output,issues,response) {
 const allowed=new Set(issues.map(i=>i.claimId)),seen=new Set(),result=structuredClone(output)
 if(!Array.isArray(response?.patches)||!response.patches.length||response.patches.length>allowed.size)throw Error('research_patch')
 for(const patch of response.patches) {
  if(!allowed.has(patch.claimId)||seen.has(patch.claimId))throw Error('research_patch')
  const match=patch.claimId.match(/^section-([1-6])\.(title|facts|change|interpretation|watch)$/)
  if(!match||!result.sections[Number(match[1])-1])throw Error('research_patch')
  const section=result.sections[Number(match[1])-1],field=match[2],value=patch.replacement
  if(value===null){if(field!=='change')throw Error('research_patch');section.change=null}
  else {
   if(typeof value?.text!=='string'||!Array.isArray(value.evidence))throw Error('research_patch')
   if(field==='title'){
    const old=draftClaims(output).find(c=>c.claimId===patch.claimId)
    if(JSON.stringify(value.evidence)!==JSON.stringify(old.evidence))throw Error('research_patch')
    section.title=value.text
   }else section[field]={text:value.text,evidence:value.evidence}
  }
  seen.add(patch.claimId)
 }
 return result
}
