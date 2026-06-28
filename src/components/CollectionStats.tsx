'use client'
import { useMemo } from 'react'

interface Card {
  n: string; t: string; y: string; br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

interface Props {
  cards: Card[]
  accent: string
}

function top<T extends string>(arr: T[], n = 6): { label: T; count: number }[] {
  const map = new Map<T, number>()
  arr.forEach(v => { if (v) map.set(v, (map.get(v) ?? 0) + 1) })
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }))
}

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <div style={{ width: 90, fontSize: 11, fontWeight: 700, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: '0.4s' }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 800, color: '#333', textAlign: 'right', flexShrink: 0 }}>
        {count}
      </div>
    </div>
  )
}

export default function CollectionStats({ cards, accent }: Props) {
  const stats = useMemo(() => {
    const total = cards.length
    const graded = cards.filter(c => c.g && c.g !== 'Raw' && c.g !== 'Non gradée' && c.g !== '')
    const psa   = graded.filter(c => c.g?.toUpperCase().startsWith('PSA'))
    const bgs   = graded.filter(c => c.g?.toUpperCase().startsWith('BGS') || c.g?.toUpperCase().startsWith('BECKETT'))
    const sgc   = graded.filter(c => c.g?.toUpperCase().startsWith('SGC'))
    const otherGraded = graded.filter(c => !psa.includes(c) && !bgs.includes(c) && !sgc.includes(c))

    // Grade notes distribution (PSA seulement pour simplifier)
    const psaGrades = psa.map(c => {
      const m = c.g?.match(/(\d+(?:\.\d+)?)/)
      return m ? m[1] : '?'
    })

    return {
      total,
      rc: cards.filter(c => c.rc).length,
      auto: cards.filter(c => c.auto).length,
      patch: cards.filter(c => c.patch).length,
      num: cards.filter(c => c.num).length,
      graded: graded.length,
      raw: total - graded.length,
      psa: psa.length,
      bgs: bgs.length,
      sgc: sgc.length,
      otherGraded: otherGraded.length,
      topBrands: top(cards.map(c => c.br)),
      topYears:  top(cards.map(c => c.y)).sort((a, b) => (b.label > a.label ? 1 : -1)),
      topTeams:  top(cards.map(c => c.t)),
      topSeries: top(cards.map(c => c.s)),
      topGrades: top(psaGrades).sort((a, b) => parseFloat(b.label) - parseFloat(a.label)),
    }
  }, [cards])

  if (stats.total === 0) return null

  const gradedPct = stats.total > 0 ? Math.round((stats.graded / stats.total) * 100) : 0

  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
      {/* Ligne sommaire */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid #f4f4f4' }}>
        {[
          { val: stats.total,  label: 'Cartes',  color: accent },
          { val: stats.graded, label: 'Gradées', color: '#7b1fa2' },
          { val: stats.rc,     label: 'RC',      color: '#e67e22' },
          { val: stats.auto,   label: 'Auto',    color: '#2e7d32' },
          { val: stats.num,    label: 'Numérot.',color: '#1976d2' },
          { val: stats.patch,  label: 'Patch',   color: '#0097a7' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px 32px' }}>

        {/* Gradées vs Raw */}
        {stats.graded > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Gradées vs Raw
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${gradedPct}%`, background: '#7b1fa2', transition: '0.4s' }} />
              <div style={{ flex: 1, background: '#f0f0f0' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span><b style={{ color: '#7b1fa2' }}>{stats.graded}</b> <span style={{ color: '#aaa' }}>gradées ({gradedPct}%)</span></span>
              <span><b style={{ color: '#555' }}>{stats.raw}</b> <span style={{ color: '#aaa' }}>raw</span></span>
            </div>
            {stats.graded > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {stats.psa > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: '#c0392b', color: 'white', borderRadius: 4, padding: '2px 7px' }}>PSA {stats.psa}</span>}
                {stats.bgs > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: '#003DA6', color: 'white', borderRadius: 4, padding: '2px 7px' }}>BGS {stats.bgs}</span>}
                {stats.sgc > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: '#333', color: 'white', borderRadius: 4, padding: '2px 7px' }}>SGC {stats.sgc}</span>}
                {stats.otherGraded > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: '#888', color: 'white', borderRadius: 4, padding: '2px 7px' }}>Autre {stats.otherGraded}</span>}
              </div>
            )}
            {stats.psa > 0 && stats.topGrades.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', marginBottom: 5 }}>Notes PSA</div>
                {stats.topGrades.map(g => (
                  <Bar key={g.label} label={`PSA ${g.label}`} count={g.count} max={stats.topGrades[0]?.count ?? 1} color="#c0392b" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top marques */}
        {stats.topBrands.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Marques
            </div>
            {stats.topBrands.map(b => (
              <Bar key={b.label} label={b.label} count={b.count} max={stats.topBrands[0]?.count ?? 1} color={accent} />
            ))}
          </div>
        )}

        {/* Top années */}
        {stats.topYears.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Années
            </div>
            {stats.topYears.map(y => (
              <Bar key={y.label} label={y.label} count={y.count} max={Math.max(...stats.topYears.map(x => x.count))} color="#1976d2" />
            ))}
          </div>
        )}

        {/* Top équipes */}
        {stats.topTeams.length > 1 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Joueurs / Équipes
            </div>
            {stats.topTeams.map(t => (
              <Bar key={t.label} label={t.label} count={t.count} max={stats.topTeams[0]?.count ?? 1} color="#e67e22" />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
