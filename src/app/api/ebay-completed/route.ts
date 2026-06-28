import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const GRADE_KEYWORDS = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded', 'grade', 'gem', 'mint']

function titleMatchesCard(title: string, mustTerms: string[], isGraded: boolean): boolean {
  const t = normalize(title)
  if (!isGraded && GRADE_KEYWORDS.some(k => t.includes(k))) return false
  return mustTerms.every(term => t.includes(normalize(term)))
}

function medianOf(prices: number[]) {
  if (!prices.length) return 0
  const s = [...prices].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
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

  if (!name) return NextResponse.json({ sold: [] })

  const appId = process.env.EBAY_APP_ID
  if (!appId) return NextResponse.json({ sold: [] })

  const normNum = (s: string) => { const m = s?.match(/\/(\d+)/); return m ? `/${m[1]}` : s }
  const printRun = normNum(num)
  const yearShort = year?.match(/^(\d{4})/)?.[1] || year

  const GENERIC = new Set(['panini', 'topps', 'upper', 'deck', 'donruss', 'fleer', 'nba', 'nfl', 'mlb', 'basketball', 'football', 'baseball', 'card', 'cards'])
  const setWords = set.split(/\s+/).filter(w => w.length > 2 && !GENERIC.has(w.toLowerCase()))

  const keywordParts = [name, yearShort, set, variant, printRun || '', rc ? 'RC' : '', auto ? 'AUTO' : '', patch ? 'PATCH' : ''].filter(Boolean)
  const keywords = keywordParts.join(' ')

  const mustTerms: string[] = [name]
  if (yearShort) mustTerms.push(yearShort)
  if (printRun) mustTerms.push(printRun.replace('/', ''))
  if (auto) mustTerms.push('auto')
  if (rc) mustTerms.push('rc')
  const mustSetWord = setWords[0] || ''
  const isGraded = Boolean(grade && grade !== 'Raw' && grade !== 'Non gradée' && grade !== '')

  try {
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'GLOBAL-ID': 'EBAY-US',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '40',
      'sortOrder': 'EndTimeSoonest',
    })
    // itemFilter doit être passé comme query string brut (URLSearchParams encode les parenthèses)
    const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true`

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const rawItems: any[] = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

    const mapped = rawItems
      .map((item: any) => ({
        title: item.title?.[0] || '',
        price: parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || '0'),
        url: item.viewItemURL?.[0] || '',
        img: item.galleryURL?.[0] || '',
        soldDate: item.listingInfo?.[0]?.endTime?.[0] || '',
      }))
      .filter(i => i.price > 0 && titleMatchesCard(i.title, mustTerms, isGraded))
      .filter(i => !mustSetWord || normalize(i.title).includes(normalize(mustSetWord)))

    let sold = mapped
    if (sold.length >= 4) {
      const prices = [...sold].map(i => i.price).sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const med = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
      sold = sold.filter(i => i.price >= med * 0.15 && i.price <= med * 5)
    }
    sold = sold.slice(0, 20)

    const soldPrices = sold.map(i => i.price)
    return NextResponse.json({ sold, soldMedian: medianOf(soldPrices), soldCount: sold.length })
  } catch {
    return NextResponse.json({ sold: [] })
  }
}
