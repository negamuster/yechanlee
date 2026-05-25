export const config = { runtime: 'edge' }

const ALLOWED_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const { searchParams } = new URL(req.url)
  const target = searchParams.get('url')
  if (!target) return new Response('Missing url param', { status: 400 })

  let targetUrl
  try { targetUrl = new URL(target) } catch { return new Response('Invalid URL', { status: 400 }) }

  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    return new Response('Host not allowed', { status: 403 })
  }

  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      },
    })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}