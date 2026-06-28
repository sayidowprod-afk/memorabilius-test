#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const axios = require('axios')
const fs    = require('fs')

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1'
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!BASE || BASE === '/rest/v1' || !KEY) {
  console.error('❌ Variables Supabase manquantes. BASE:', BASE)
  process.exit(1)
}

const headers = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function retry(fn, attempts = 4, delay = 2000) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      if (i === attempts - 1) throw e
      console.log(`  ⚠️  Retry ${i + 1}/${attempts - 1}: ${e.message}`)
      await sleep(delay)
    }
  }
}

const ax = axios.create()

async function upsertSet(set, year, brand, totalCards, sport) {
  const { data } = await ax.post(
    `${BASE}/card_sets?on_conflict=tcdb_id&select=id`,
    { tcdb_id: set.tcdb_id, name: set.name, year, brand, sport, total_cards: totalCards },
    { headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' } }
  )
  return Array.isArray(data) ? data[0] : data
}

async function deleteEntries(setId) {
  await ax.delete(`${BASE}/card_set_entries?set_id=eq.${setId}`, { headers })
}

async function insertBatch(batch) {
  await ax.post(`${BASE}/card_set_entries`, batch, {
    headers: { ...headers, Prefer: 'return=minimal' }
  })
}

async function main() {
  const tmpFile = process.argv[2]
  if (!tmpFile || !fs.existsSync(tmpFile)) { console.error('❌ Fichier JSON requis'); process.exit(1) }

  const { year, sets, sport: jsonSport } = JSON.parse(fs.readFileSync(tmpFile, 'utf8'))
  const sport = jsonSport || 'nba'
  const seasonLabel = sport === 'nfl' ? String(year) : `${year}-${String(year + 1).slice(2)}`
  console.log(`📥 Import ${sets.length} sets — saison ${seasonLabel} (${sport.toUpperCase()})\n`)

  let ok = 0, err = 0
  for (const { set, unique, brand } of sets) {
    console.log(`💾 ${set.name} — ${unique.length} cartes`)
    try {
      const setData = await retry(() => upsertSet(set, year, brand, unique.length, sport))
      await retry(() => deleteEntries(setData.id))

      for (let i = 0; i < unique.length; i += 500) {
        const batch = unique.slice(i, i + 500).map(c => ({ set_id: setData.id, ...c }))
        await retry(() => insertBatch(batch))
        process.stdout.write(`\r  ${Math.min(i + 500, unique.length)}/${unique.length} cartes...`)
      }
      console.log(`\r  ✅ ${unique.length} cartes insérées (id: ${setData.id})`)
      ok++
    } catch (e) {
      console.log(`\n  ❌ ${e.response?.data || e.message}`)
      err++
    }
  }

  console.log(`\n🏁 Terminé: ${ok} sets OK, ${err} erreurs`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
