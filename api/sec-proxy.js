export const config = { runtime: 'edge' }

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url || !url.startsWith('https://')) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 })
  }

  // SEC 도메인만 허용
  const allowed = ['data.sec.gov', 'www.sec.gov']
  const urlObj = new URL(url)
  if (!allowed.includes(urlObj.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Anthracite yechan030102@gmail.com',
        'Accept': 'application/json, application/xml, text/xml, text/html, */*',
      }
    })

    const contentType = res.headers.get('content-type') || ''
    const body = await res.text()

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}