export interface CsvCard {
  img: string
  name: string
  team: string
  year: string
  brand: string
  serie: string
  variant: string
  num: string
  auto: boolean
  rc: boolean
  patch: boolean
  user_id: string
  display_name: string
  avatar_url: string | null
  accent: string
}

export async function fetchCsvCardsForProfiles(
  profiles: { id: string; display_name: string; avatar_url: string | null; lien_csv: string | null; couleur_bordure?: string | null }[]
): Promise<CsvCard[]> {
  const all: CsvCard[] = []
  await Promise.all(
    profiles.filter(p => p.lien_csv).map(async p => {
      try {
        const r = await fetch(p.lien_csv!, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } })
        if (!r.ok) return
        const text = await r.text()
        const rows = text.split(/\r?\n/).slice(4)
        rows.forEach(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0]?.includes('http')) return
          all.push({
            img:    c[0]?.trim(),
            name:   (c[2] || '').replace(/^"|"$/g, ''),
            team:   (c[3] || '').replace(/^"|"$/g, ''),
            year:   (c[4] || '').replace(/^"|"$/g, ''),
            brand:  (c[5] || '').replace(/^"|"$/g, ''),
            serie:  (c[6] || '').replace(/^"|"$/g, ''),
            variant:(c[7] || '').replace(/^"|"$/g, ''),
            num:    (c[8] || '').replace(/^"|"$/g, ''),
            auto:   (c[9] || '').toLowerCase().includes('oui'),
            rc:     (c[10] || '').toLowerCase().includes('oui'),
            patch:  (c[11] || '').toLowerCase().includes('oui'),
            user_id: p.id,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            accent: p.couleur_bordure || '#003DA6',
          })
        })
      } catch { /* skip unreachable CSV */ }
    })
  )
  return all
}
