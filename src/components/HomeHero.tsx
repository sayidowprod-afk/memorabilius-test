'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function HomeHero({ total, totalCartes }: { total: number, totalCartes: number }) {
  const { t, lang } = useLang()

  const steps = lang === 'fr' ? [
    { n: 1, title: 'Créez votre inventaire', desc: 'Utilisez notre template Google Sheets pour cataloguer vos cartes avec photos, variantes, grades et numérotations.', link: 'https://docs.google.com/spreadsheets', linkText: 'Voir le template →' },
    { n: 2, title: 'Publiez en CSV', desc: 'Dans Google Sheets : Fichier > Partager > Publier sur le web > Format CSV. Copiez le lien généré.', link: '/tuto', linkText: 'Voir le tutoriel →' },
    { n: 3, title: 'Liez et admirez', desc: 'Collez votre lien CSV dans votre profil Memorabilius. Votre galerie 3D interactive est générée instantanément.', link: '/sinscrire', linkText: "S'inscrire maintenant →" },
    { n: 4, title: 'Partagez', desc: 'Partagez votre galerie unique avec la communauté et explorez les collections des autres collectionneurs.', link: '/annuaire', linkText: "Voir l'annuaire →" },
  ] : [
    { n: 1, title: 'Create your inventory', desc: 'Use our Google Sheets template to catalog your cards with photos, variants, grades and numbering.', link: 'https://docs.google.com/spreadsheets', linkText: 'View template →' },
    { n: 2, title: 'Publish as CSV', desc: 'In Google Sheets: File > Share > Publish to web > CSV format. Copy the generated link.', link: '/tuto', linkText: 'View tutorial →' },
    { n: 3, title: 'Link and admire', desc: 'Paste your CSV link in your Memorabilius profile. Your interactive 3D gallery is generated instantly.', link: '/sinscrire', linkText: 'Sign up now →' },
    { n: 4, title: 'Share', desc: 'Share your unique gallery with the community and explore other collectors\' collections.', link: '/annuaire', linkText: 'View directory →' },
  ]

  return (
    <>
      <section style={{
        textAlign: 'center', padding: '60px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: 20, marginBottom: 40,
        contain: 'layout style',
      }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#121212', marginBottom: 20, lineHeight: 1 }}>
          {t('home_hero')}
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: 600, margin: '0 auto 30px' }}>
          {t('home_sub')}
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sinscrire" className="btn-main btn-primary">{t('home_cta1')}</Link>
          <Link href="/annuaire" className="btn-main btn-secondary">{t('home_cta2')}</Link>
        </div>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          {[
            { val: total, label: t('home_collectors') },
            { val: totalCartes.toLocaleString('fr-FR'), label: t('home_cards') },
            { val: '100%', label: t('home_3d') },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#003DA6' }}>{s.val}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 60 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#003DA6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, marginBottom: 12 }}>{s.n}</div>
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{s.desc}</p>
            <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13 }}>{s.linkText}</a>
          </div>
        ))}
      </section>
    </>
  )
}
