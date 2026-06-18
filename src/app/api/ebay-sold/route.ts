import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const GRADE_KEYWORDS = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded', 'grade', 'gem', 'mint']

function titleMatchesCard(title: string, mustTerms: string[], isGraded: boolean): boolean {
  const t = normalize(title)
  if (!isGraded && GRADE_KEYWORDS.some(k => t.includes(k))) return false
  return mustTerms.every(term => t.includes(normalize(term)))
}

async function getOAuthToken(appId: string, certId: string): Promise<string | null> {
  try {
    const creds = Buffer.from(`${appId}:${certId}`).toString('base64')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      cache: 'no-store',
    })
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const name    = searchParams.get('name') || ''
  const set     = searchParams.get('set') || ''
  const year    = searchParams.get('year') || ''
  const num     = searchParams.get('num') || ''
  const variant = searchParams.get('variant') || ''
  const rc      = searchParams.get('rc') === 'true'
  const auto    = searchParams.get('auto') === 'true'
  const patch   = searchParams.get('patch') === 'true'
  const grade   = searchParams.get('grade') || ''

  if (!name) return NextResponse.json({ items: [] })

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ error: 'missing credentials' }, { status: 500 })

  const normNum = (s: string) => { const m = s?.match(/\/(\d+)/); return m ? `/${m[1]}` : s }
  const printRun = normNum(num)

  const keywordParts = [
    name, year,
    set || variant,
    printRun || '',
    rc ? 'RC' : '',
    auto ? 'AUTO' : '',
    patch ? 'PATCH' : '',
  ].filter(Boolean)
  const keywords = keywordParts.join(' ')

  const mustTerms: string[] = [name]
  if (year) mustTerms.push(year)
  if (printRun) mustTerms.push(printRun.replace('/', ''))
  if (auto) mustTerms.push('auto')
  if (rc) mustTerms.push('rc')

  const isGraded = Boolean(grade && grade !== 'Raw' && grade !== 'Non gradée' && grade !== '')

  // Obtenir le token OAuth
  const token = await getOAuthToken(appId, certId)
  if (!token) return NextResponse.json({ items: [] })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    // Browse API — items vendus récemment
    const params = new URLSearchParams({
      q: keywords,
      filter: 'soldItems:{true},buyingOptions:{FIXED_PRICE|BEST_OFFER}',
      limit: '20',
      sort: 'newlyListed',
    })

    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=FR',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)

    const data = await res.json()
    const rawItems = data?.itemSummaries || []

    const items = rawItems
      .map((item: any) => ({
        title: item.title || '',
        price: parseFloat(item.price?.value || item.currentBidPrice?.value || '0'),
        currency: '€',
        date: item.itemEndDate || item.soldDate || new Date().toISOString(),
        url: item.itemWebUrl || '',
      }))
      .filter((i: any) => i.price > 0)
      .filter((i: any) => titleMatchesCard(i.title, mustTerms, isGraded))
      .sort((a: any, b: any) => a.price - b.price)

    if (items.length >= 4) {
      const mid = Math.floor(items.length / 2)
      const median = items.length % 2 === 0
        ? (items[mid - 1].price + items[mid].price) / 2
        : items[mid].price
      const filtered = items.filter((i: any) => i.price >= median * 0.15 && i.price <= median * 5)
      return NextResponse.json({ items: filtered.slice(0, 10) })
    }

    return NextResponse.json({ items: items.slice(0, 10) })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
