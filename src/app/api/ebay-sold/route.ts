import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Mots qui indiquent un grade PSA/BGS/SGC — on les exclut si la carte n'est pas gradée
const GRADE_KEYWORDS = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded', 'grade', 'gem', 'mint']

function titleMatchesCard(title: string, mustTerms: string[], isGraded: boolean): boolean {
  const t = normalize(title)

  // Exclure les cartes gradées si la notre ne l'est pas
  if (!isGraded && GRADE_KEYWORDS.some(k => t.includes(k))) return false

  // Tous les termes obligatoires doivent être dans le titre
  return mustTerms.every(term => t.includes(normalize(term)))
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

  const appId = process.env.EBAY_APP_ID
  if (!appId) return NextResponse.json({ error: 'no app id' }, { status: 500 })

  // Extraire /99 de "23/99"
  const normNum = (s: string) => { const m = s?.match(/\/(\d+)/); return m ? `/${m[1]}` : s }
  const printRun = normNum(num)

  // Construire la requête eBay — termes principaux seulement (pas trop restrictif)
  const keywordParts = [
    name,
    year,
    set || variant,  // l'un ou l'autre suffit pour la recherche
    printRun || '',
    rc ? 'RC' : '',
    auto ? 'AUTO' : '',
    patch ? 'PATCH' : '',
  ].filter(Boolean)

  const keywords = keywordParts.join(' ')

  // Termes OBLIGATOIRES pour le filtrage côté serveur
  const mustTerms: string[] = [name]
  if (year) mustTerms.push(year)
  if (printRun) mustTerms.push(printRun.replace('/', ''))  // "99" dans le titre
  if (auto) mustTerms.push('auto')
  if (rc) mustTerms.push('rc')

  const isGraded = Boolean(grade && grade !== 'Raw' && grade !== 'Non gradée' && grade !== '')

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': keywords,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'Currency',
    'itemFilter(1).value': 'EUR',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '20',  // On prend plus pour filtrer ensuite
    'outputSelector': 'SellingStatus',
  })

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`

  try {
    const ebayController = new AbortController()
    const ebayTimeout = setTimeout(() => ebayController.abort(), 12000)
    const res = await fetch(url, { signal: ebayController.signal, cache: 'no-store' })
    clearTimeout(ebayTimeout)
    const text = await res.text()
    let data: any
    try { data = JSON.parse(text) } catch {
      return NextResponse.json({ error: `eBay HTTP ${res.status}` }, { status: 502 })
    }

    const rawItems = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

    const items = rawItems
      .map((item: any) => ({
        title: item.title?.[0] || '',
        price: parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
        currency: '€',
        date: item.listingInfo?.[0]?.endTime?.[0] || '',
        url: item.viewItemURL?.[0] || '',
      }))
      .filter((i: any) => i.price > 0)
      .filter((i: any) => titleMatchesCard(i.title, mustTerms, isGraded))
      // Supprimer les outliers extrêmes (>3x la médiane ou <0.1x)
      .sort((a: any, b: any) => a.price - b.price)

    // Calcul de la médiane pour détecter les outliers
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
