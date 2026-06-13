'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function HomeHero({ total, totalCartes }: { total: number; totalCartes: number }) {
  const { t, lang } = useLang()

  const steps = lang === 'fr' ? [
    { n: 1, title: 'Préparez votre Google Sheet', desc: "Utilisez notre modèle pré-rempli pour lister vos cartes (photos, noms, variations). C'est votre base de données personnelle.", link: 'https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy', linkText: '📄 Créer ma copie du modèle →' },
    { n: 2, title: 'Publiez au format CSV', desc: 'Dans Google Sheets, allez dans Fichier > Partager > Publier sur le Web. Choisissez le format "Valeurs séparées par des virgules (.csv)".' },
    { n: 3, title: 'Liez et admirez', desc: 'Collez votre lien CSV dans votre profil Memorabilius. Votre galerie 3D interactive est générée instantanément.', link: '/sinscrire', linkText: "S'inscrire maintenant →" },
  ] : [
    { n: 1, title: 'Prepare your Google Sheet', desc: "Use our pre-filled template to list your cards (photos, names, variants). It's your personal database.", link: 'https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy', linkText: '📄 Create my copy →' },
    { n: 2, title: 'Publish as CSV', desc: 'In Google Sheets, go to File > Share > Publish to Web. Choose "Comma-separated values (.csv)" format.' },
    { n: 3, title: 'Link and admire', desc: 'Paste your CSV link in your Memorabilius profile. Your interactive 3D gallery is generated instantly.', link: '/sinscrire', linkText: 'Sign up now →' },
  ]

  return (
    <>
      <section style={{
        textAlign: 'center', padding: '80px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: 20, marginBottom: 40,
      }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#121212', marginBottom: 20, lineHeight: 1 }}>
          {t('home_hero')}
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: 600, margin: '0 auto 30px' }}>
          {t('home_sub')}
        </p>
        <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sinscrire" className="btn-main btn-primary">{t('home_cta1')}</Link>
          <Link href="/annuaire" className="btn-main btn-secondary">{t('home_cta2')}</Link>
        </div>
      </section>

      <div className="section-title">{lang === 'fr' ? 'Comment ça marche ?' : 'How it works?'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 25, marginBottom: 60 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background: 'white', padding: 30, borderRadius: 15, border: '1px solid #eee', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -15, left: 20, background: '#003DA6', color: 'white', width: 35, height: 35, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{s.n}</div>
            <h4 style={{ margin: '15px 0 10px', fontWeight: 800, fontSize: 18 }}>{s.title}</h4>
            <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{s.desc}</p>
            {s.link && <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, display: 'inline-block', marginTop: 10 }}>{s.linkText}</a>}
          </div>
        ))}
      </section>

      <div className="section-title">{lang === 'fr' ? 'En chiffres' : 'By the numbers'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: t('home_collectors') },
          { val: totalCartes.toLocaleString('fr-FR'), label: t('home_cards') },
          { val: '100%', label: t('home_3d') },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#003DA6' }}>{s.val}</h3>
            <p style={{ color: '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>

      <div className="section-title">{t('home_pepites')}</div>
    </>
  )
}
