import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })
  if (!url.startsWith('https://docs.google.com/spreadsheets/')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const r = await fetch(url, { next: { revalidate: 3600 } })
    if (!r.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    const text = await r.text()
    const lines = text.split(/\r?\n/).slice(1)
    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }
    lines.forEach(line => {
      const c = line.split(',')
      if (!c[0] || c[0].length < 10) return
      stats.total++
      if (c[10]?.toLowerCase().includes('oui')) stats.rc++
      if (c[9]?.toLowerCase().includes('oui')) stats.auto++
      if (c[11]?.toLowerCase().includes('oui')) stats.patch++
      if (c[8]?.trim()) stats.num++
    })
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
