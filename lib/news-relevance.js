// Shared by ingestion and cached browser lists. Require concrete corporate impact
// to retain routine announcements; "investment" alone is not such evidence.
export function isRoutineNews(value) {
  const title = String(value).normalize('NFKC')
  const impact = /고용시장|노동시장|실업률|취업자|실적|매출|영업이익|순이익|가이던스|주가|파업|지분\s*매각|인수합병|구조조정|대규모\s*해고|공시|거래정지|상장폐지|중계권|\b(?:earnings|revenue|guidance|merger|acquisition|layoffs?|trading halt|delisting|broadcast rights)\b/i.test(title)
  const routine = /^\s*\[(?:포토|사진|표|인사|부고|동정)\]|신입\s*(?:직원|사원)|채용\s*(?:공고|공모|모집)|신임\s*회장|기부\s*마라톤|특강.*(?:들어|신청|모집)|(?:강연|세미나).*참가자\s*모집|\b(?:we are hiring|job vacancies|register for .*webinar)\b/i.test(title)
  const entertainment = /런닝맨|예능|연예인|(?:^|\s)배우(?:\s|$)|아이돌|\b(?:celebrity|celebrities|reality tv)\b/i.test(title)
  return (routine || entertainment) && !impact
}
