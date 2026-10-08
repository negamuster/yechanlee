// robots access is not a copyright license. Commercial article bodies are disabled
// until reuse AND transmission to an unpaid model service are cleared.
export const SOURCE_POLICY = '2026-10-08-public-domain-v1'
export function bodyPermission(url) {
  try {
    const u=new URL(url)
    return u.protocol==='https:' && !u.username && !u.password && !u.port &&
      u.hostname==='www.bea.gov' && /^\/news\/\d{4}\/[a-z0-9-]+$/.test(u.pathname)
      ? 'public-domain-bea' : 'permission_unconfirmed'
  } catch { return 'permission_unconfirmed' }
}
export function robotsAllowed(text, url, agent='anthracitebriefing') {
  const groups=[];let group=null,hasRules=false
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.split('#')[0].trim(),m=line.match(/^([^:]+):\s*(.*)$/)
    if(!m)continue
    const key=m[1].toLowerCase(),value=m[2].trim()
    if(key==='user-agent') {
      if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false}
      group.agents.push(value.toLowerCase())
    } else if(group&&['allow','disallow'].includes(key)) {hasRules=true;if(value)group.rules.push({allow:key==='allow',path:value})}
  }
  const specificity=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1))
  const best=Math.max(-1,...groups.map(specificity)),path=new URL(url).pathname+new URL(url).search
  const matches=groups.filter(g=>specificity(g)===best&&best>=0).flatMap(g=>g.rules).filter(r=>{
    const anchored=r.path.endsWith('$'),raw=anchored?r.path.slice(0,-1):r.path
    const pattern=raw.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')
    return new RegExp('^'+pattern+(anchored?'$':'')).test(path)
  }).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length||Number(b.allow)-Number(a.allow))
  return matches[0]?.allow??true
}
