import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function getDernieresPepites() {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, lien_csv')
      .not('lien_csv', 'is', null)
      .neq('lien_csv', '')
      .order('updated_at', { ascending: false })
      .limit(4)

    if (!profiles) return []

    const allCards: any[] = []

    await Promise.all(profiles.map(async (p) => {
      try {
        const r = await fetch(p.lien_csv, { next: { revalidate: 3600 } })
        if (!r.ok) return
        const text = await r.text()
        const rows = text.split(/\r?\n/).filter(Boolean)
        // Prendre les dernières lignes (hors header = 4 lignes)
        const dataRows = rows.slice(4).filter(row => row.includes('http'))
        const last = dataRows.slice(-3) // 3 dernières cartes par utilisateur
        last.forEach(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0]?.includes('http')) return
          allCards.push({
            img: c[0]?.trim(),
            name: c[2] || '',
            variant: c[7] || '',
            year: c[4] || '',
            brand: c[5] || '',
            serie: c[6] || '',
            rc: c[10]?.toLowerCase().includes('oui'),
            auto: c[9]?.toLowerCase().includes('oui'),
            patch: c[11]?.toLowerCase().includes('oui'),
            num: c[8] || '',
            collector: p.display_name,
            userId: p.id,
          })
        })
      } catch { }
    }))

    // Mélanger et prendre 6
    return allCards.sort(() => Math.random() - 0.5).slice(0, 6)
  } catch { return [] }
}

export default async function Home() {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const total = count ?? 0
  const pepites = await getDernieresPepites()

  return (
    <div>
      {/* Hero */}
      <section style={{
        textAlign: 'center', padding: '80px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: 20, marginBottom: 40,
      }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#121212', marginBottom: 20, lineHeight: 1 }}>
          Exposez votre passion en 3D.
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: 600, margin: '0 auto 30px' }}>
          La plateforme ultime pour les collectionneurs de cartes de Sports. Gérez votre inventaire via Google Sheets et partagez votre galerie interactive avec le monde entier.
        </p>
        <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sinscrire" className="btn-main btn-primary">Créer ma galerie</Link>
          <Link href="/annuaire" className="btn-main btn-secondary">Explorer les collections</Link>
        </div>
      </section>

      {/* Tutoriel */}
      <div className="section-title">Comment ça marche ?</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 25, marginBottom: 60 }}>
        {[
          { n: 1, title: 'Préparez votre Google Sheet', desc: 'Utilisez notre modèle pré-rempli pour lister vos cartes (photos, noms, variations). C\'est votre base de données personnelle.', link: 'https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy', linkText: '📄 Créer ma copie du modèle →' },
          { n: 2, title: 'Publiez au format CSV', desc: 'Dans Google Sheets, allez dans Fichier > Partager > Publier sur le Web. Choisissez le format "Valeurs séparées par des virgules (.csv)".' },
          { n: 3, title: 'Liez et admirez', desc: 'Collez votre lien CSV dans votre profil Memorabilius. Votre galerie 3D interactive est générée instantanément.', link: '/sinscrire', linkText: 'S\'inscrire maintenant →' },
        ].map(s => (
          <div key={s.n} style={{ background: 'white', padding: 30, borderRadius: 15, border: '1px solid #eee', position: 'relative', transition: '0.3s' }}>
            <div style={{ position: 'absolute', top: -15, left: 20, background: '#003DA6', color: 'white', width: 35, height: 35, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{s.n}</div>
            <h4 style={{ margin: '15px 0 10px', fontWeight: 800, fontSize: 18 }}>{s.title}</h4>
            <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{s.desc}</p>
            {s.link && <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, display: 'inline-block', marginTop: 10 }}>{s.linkText}</a>}
          </div>
        ))}
      </section>

      {/* Stats */}
      <div className="section-title">En chiffres</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: 'Collectionneurs' },
          { val: '+300', label: 'Cartes répertoriées' },
          { val: '100%', label: 'Interactif & 3D' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#003DA6' }}>{s.val}</h3>
            <p style={{ color: '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Dernières pépites */}
      {pepites.length > 0 && (
        <>
          <div className="section-title">Dernières pépites</div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, marginBottom: 60 }}>
            {pepites.map((card, i) => (
              <Link key={i} href={`/galerie/${card.userId}`} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', textDecoration: 'none', transition: '0.3s', display: 'block' }}>
                <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                  <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {card.rc && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, background: '#fff3e0', color: '#e67e22' }}>RC</span>}
                    {card.auto && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, background: '#e8f5e9', color: '#2e7d32' }}>AUTO</span>}
                    {card.num && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, background: '#f5f5f5', color: '#444' }}>#{card.num}</span>}
                    {card.patch && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, background: '#e3f2fd', color: '#1976d2' }}>PATCH</span>}
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#121212' }}>{card.name}</p>
                  {card.variant && <p style={{ fontSize: 10, color: '#003DA6', fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.variant}</p>}
                  <p style={{ fontSize: 10, color: '#999', margin: '2px 0 4px' }}>{card.year} {card.brand}</p>
                  <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>Par {card.collector}</p>
                </div>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
