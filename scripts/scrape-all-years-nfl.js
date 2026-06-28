#!/usr/bin/env node
/**
 * Scraper TCDB NFL — Toutes saisons 2024→1980, Major Releases uniquement
 * Checkpoint, délais aléatoires anti-détection, import via nouveau process
 *
 * Usage:
 *   node scripts/scrape-all-years-nfl.js
 *   node scripts/scrape-all-years-nfl.js --from=2020 --to=2000
 *   node scripts/scrape-all-years-nfl.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin  = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const CHECKPOINT    = path.join(__dirname, 'checkpoint-all-nfl.json')
const DATA_DIR      = path.join(__dirname, 'year-data')
const IMPORT_SCRIPT = path.join(__dirname, 'import-tcdb.js')

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const FROM    = args.from  ? parseInt(args.from)  : 2024
const TO      = args.to    ? parseInt(args.to)    : 1980
const DRY_RUN = !!args['dry-run']

const rand    = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep   = ms => new Promise(r => setTimeout(r, ms))
const delayTeam  = () => sleep(rand(600, 1400))
const delaySet   = () => sleep(rand(3000, 7000))
const BREAK_EVERY = 30
const delayBreak = () => {
  const ms = rand(90000, 150000)
  console.log(`\n☕ Pause anti-détection ${Math.round(ms/1000)}s...\n`)
  return sleep(ms)
}

const NFL_TEAMS = new Set([
  // Équipes actuelles (32)
  'Arizona Cardinals','Atlanta Falcons','Baltimore Ravens','Buffalo Bills',
  'Carolina Panthers','Chicago Bears','Cincinnati Bengals','Cleveland Browns',
  'Dallas Cowboys','Denver Broncos','Detroit Lions','Green Bay Packers',
  'Houston Texans','Indianapolis Colts','Jacksonville Jaguars','Kansas City Chiefs',
  'Las Vegas Raiders','Los Angeles Chargers','Los Angeles Rams','Miami Dolphins',
  'Minnesota Vikings','New England Patriots','New Orleans Saints','New York Giants',
  'New York Jets','Philadelphia Eagles','Pittsburgh Steelers','San Francisco 49ers',
  'Seattle Seahawks','Tampa Bay Buccaneers','Tennessee Titans','Washington Commanders',
  // Noms historiques
  'Oakland Raiders','San Diego Chargers','St. Louis Rams','Baltimore Colts',
  'Boston Patriots','Houston Oilers','Tennessee Oilers','Washington Redskins',
  'Washington Football Team','Phoenix Cardinals','St. Louis Cardinals',
  'Chicago Cardinals','Los Angeles Raiders','Cleveland Browns',
  'Portsmouth Spartans','Staten Island Stapletons','Newark Tornadoes',
  'Minneapolis Red Jackets','Frankford Yellow Jackets',
])

const MAJOR_BRANDS = /(Panini|Topps|Upper Deck|Fleer|Donruss|Score|Bowman|Finest|Prizm|Select|Mosaic|Chronicles|Contenders|Spectra|Noir|Eminence|Obsidian|Immaculate|National Treasures|Optic|Revolution|Leaf|Sage|SP Authentic|SP|SP Legendary|SAGE|Ultra|Playoff|Pacific|Collector's Edge|Classic)/i

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) }
  catch { return { doneYears: [], doneTcdbIds: [] } }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

// ── TCDB scraping ─────────────────────────────────────────────────────────────

async function waitCF(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 15; i++) {
    const t = await page.title()
    if (!t.includes('instant') && !t.includes('moment')) break
    await sleep(2000)
  }
}

async function fetchSets(page, year) {
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Football/year/${year}`)
  await sleep(rand(500, 1000))

  return await page.evaluate(() => {
    const results = []
    const seen = new Set()
    let inMajor = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','H4','LI','A'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode
      const tag = el.tagName
      const text = el.textContent?.trim() || ''
      if (['H3','H2','H4'].includes(tag)) {
        inMajor = /^major releases?$/i.test(text)
        continue
      }
      if (!inMajor) continue
      if (tag === 'A') {
        const href = el.getAttribute('href') || ''
        const m = href.match(/sid\/(\d+)/)
        if (!m || seen.has(m[1])) continue
        const name = el.textContent?.trim()
        if (!name || name.length < 3) continue
        seen.add(m[1])
        results.push({ tcdb_id: parseInt(m[1]), name })
      }
    }
    return results
  })
}

async function fetchTeams(page, sid, year) {
  // TCDB NFL: essaie d'abord avec le slug simple (ex: "2024"), puis sans slug
  const slugs = [String(year), `${year}-${String(year + 1).slice(2)}`]
  for (const slug of slugs) {
    await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}/${slug}`)
    await sleep(rand(300, 700))

    const teams = await page.evaluate((NFL_TEAMS_ARR) => {
      const nflSet = new Set(NFL_TEAMS_ARR)
      const results = []
      const seen = new Set()
      document.querySelectorAll('a[href*="/team/"]').forEach(a => {
        const href = a.getAttribute('href') || ''
        const m = href.match(/\/team\/(\d+)\/(.+)/)
        if (!m || seen.has(m[1])) return
        seen.add(m[1])
        results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')) })
      })
      return results.filter(t => nflSet.has(t.teamName))
    }, [...NFL_TEAMS])

    if (teams.length > 0) return teams
  }

  // Dernier recours: URL sans slug
  await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}`)
  await sleep(rand(300, 700))
  const teams = await page.evaluate((NFL_TEAMS_ARR) => {
    const nflSet = new Set(NFL_TEAMS_ARR)
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return
      seen.add(m[1])
      results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')) })
    })
    return results.filter(t => nflSet.has(t.teamName))
  }, [...NFL_TEAMS])
  return teams
}

async function fetchTeamCards(page, sid, teamId, teamName) {
  const encoded = encodeURIComponent(teamName)
  await waitCF(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${encoded}`)
  await sleep(rand(250, 600))

  return await page.evaluate(() => {
    const cards = []
    let currentVariation = null
    let inInserts = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','STRONG','TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode
      const tag = el.tagName
      const text = el.textContent?.trim() || ''
      if (tag === 'H3' || tag === 'H2') {
        if (/^base cards?$/i.test(text)) { currentVariation = null; inInserts = false }
        else if (/^inserts and related/i.test(text)) { inInserts = true; currentVariation = null }
        continue
      }
      if (tag === 'STRONG' && inInserts) {
        if (text && text.length < 100 && !/^\d+\s*record/i.test(text)) currentVariation = text
        continue
      }
      if (tag === 'TR') {
        const tds = Array.from(el.querySelectorAll('td'))
        if (tds.length < 2) continue
        let cardNum = null, playerName = null, team = null
        for (const td of tds) {
          const rawText = td.textContent?.trim() || ''
          const linkText = td.querySelector('a')?.textContent?.trim() || null
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isPlayerName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isPlayerName) { playerName = linkText; continue }
          if (playerName && !team && isPlayerName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({
          card_number: cardNum, player_name: playerName, team: team || null,
          variation: currentVariation || null,
          is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText),
        })
      }
    }
    return cards
  })
}

// ── Import via nouveau process PowerShell ─────────────────────────────────────

function importYear(jsonFile) {
  console.log(`\n🚀 Import via nouveau process...`)
  const result = spawnSync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Start-Process -Wait -NoNewWindow -FilePath node -ArgumentList '${IMPORT_SCRIPT}','${jsonFile}'`
  ], { stdio: 'inherit' })
  return result.status === 0
}

// ── Scraper un set ────────────────────────────────────────────────────────────

async function scrapeSet(page, set, year, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) {
    console.log(`  ⏭️  tcdb_id:${set.tcdb_id} déjà fait`)
    return null
  }

  const teams = await fetchTeams(page, set.tcdb_id, year)
  if (!teams.length) { console.log(`  ⚠️  0 équipes NFL — ignoré`); return null }
  console.log(`  📂 ${teams.length} équipes`)

  const allCards = []
  for (let ti = 0; ti < teams.length; ti++) {
    const { teamId, teamName } = teams[ti]
    process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
    let ok = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamName)
        allCards.push(...cards)
        console.log(cards.length)
        ok = true
        break
      } catch (e) {
        if (attempt < 3) {
          const wait = rand(3000, 6000) * attempt
          process.stdout.write(`❌ retry ${attempt}/3 (${Math.round(wait/1000)}s)... `)
          await sleep(wait)
        } else {
          console.log(`❌ abandon après 3 tentatives: ${e.message}`)
        }
      }
    }
    if (ok) await delayTeam()
  }

  if (!allCards.length) { console.log(`  ⚠️  0 cartes`); return null }

  const seen = new Set()
  const unique = allCards.filter(c => {
    const k = `${c.card_number}|${c.player_name}|${c.variation||''}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  const brandMatch = set.name.match(MAJOR_BRANDS)
  console.log(`  📊 ${unique.length} cartes uniques`)
  return { set, unique, brand: brandMatch ? brandMatch[1] : null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)

  const cp = loadCheckpoint()
  console.log(`🏈 Scraper NFL — saisons ${FROM} → ${TO}`)
  console.log(`   Major Releases uniquement | Checkpoint: ${cp.doneYears.length} années déjà faites\n`)

  const years = []
  for (let y = FROM; y >= TO; y--) years.push(y)
  const remaining = years.filter(y => !cp.doneYears.includes(y))
  console.log(`   ${remaining.length} années à scraper\n`)

  let browser = null
  let totalSets = 0

  const openBrowser = async () => {
    if (browser) { try { await browser.close() } catch {} }
    await sleep(3000)
    browser = await puppeteerExtra.launch({
      executablePath: findChrome(),
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--window-size=1280,900'],
    })
    const page = await browser.newPage()
    await waitCF(page, TCDB)
    await sleep(rand(2000, 4000))
    console.log('✓ Browser OK')
    return page
  }

  let page = await openBrowser()

  try {
    for (let yi = 0; yi < remaining.length; yi++) {
      const year = remaining[yi]
      console.log(`\n${'═'.repeat(60)}`)
      console.log(`📅 Saison NFL ${year} (${yi+1}/${remaining.length})`)
      console.log(`${'═'.repeat(60)}`)

      if (yi > 0 && yi % 8 === 0) {
        console.log('\n🔄 Restart browser (anti-détection)...')
        page = await openBrowser()
      }

      let sets = []
      try {
        sets = await fetchSets(page, year)
        console.log(`   ${sets.length} sets Major Releases trouvés`)
      } catch (e) {
        console.log(`   ❌ fetchSets: ${e.message} — année ignorée`)
        cp.doneYears.push(year)
        saveCheckpoint(cp)
        continue
      }

      if (!sets.length) {
        console.log(`   Aucun set — année marquée OK`)
        cp.doneYears.push(year)
        saveCheckpoint(cp)
        continue
      }

      let yearOk = 0
      for (let si = 0; si < sets.length; si++) {
        const set = sets[si]
        console.log(`\n  [${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)

        try {
          const result = await scrapeSet(page, set, year, cp)
          if (result) {
            totalSets++
            if (!DRY_RUN) {
              const jsonFile = path.join(DATA_DIR, `scraped-${set.tcdb_id}.json`)
              fs.writeFileSync(jsonFile, JSON.stringify({ year, sport: 'nfl', sets: [result] }, null, 2))
              const ok = importYear(jsonFile)
              if (ok) {
                cp.doneTcdbIds.push(set.tcdb_id)
                saveCheckpoint(cp)
                yearOk++
                console.log(`  ✅ Importé`)
              } else {
                console.log(`  ⚠️  Import échoué — JSON conservé: ${jsonFile}`)
              }
            } else {
              yearOk++
            }
          }
        } catch (e) {
          console.log(`  ❌ ${e.message}`)
        }

        if (totalSets > 0 && totalSets % BREAK_EVERY === 0) await delayBreak()
        else if (si < sets.length - 1) await delaySet()
      }

      if (DRY_RUN) console.log(`  [DRY-RUN] ${yearOk} sets scrapés`)

      cp.doneYears.push(year)
      saveCheckpoint(cp)

      if (yi < remaining.length - 1) {
        const ms = rand(8000, 18000)
        console.log(`\n⏳ Pause entre années: ${Math.round(ms/1000)}s...`)
        await sleep(ms)
      }
    }

    console.log(`\n\n🏁 TERMINÉ — ${cp.doneYears.length} années scrapées`)
    const pending = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    if (pending.length > 0) {
      console.log(`\n📂 JSONs disponibles si besoin de ré-importer:`)
      pending.forEach(f => console.log(`   node scripts/import-tcdb.js scripts/year-data/${f}`))
    }
  } finally {
    try { await browser.close() } catch {}
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
