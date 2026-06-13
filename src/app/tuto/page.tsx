'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function Tuto() {
  const { t } = useLang()
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* Tutoriel Vidéo */}
      <h2 style={{ fontWeight: 900, fontSize: 28, marginBottom: 16 }}>{t('tuto_video')}</h2>
      <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 48, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', aspectRatio: '16/9', position: 'relative' }}>
        <iframe
          src="https://www.youtube.com/embed/bMnV8jGQbGU"
          title="Tutoriel Memorabilius"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 8 }}>{t('tuto_title')}</h1>
      <p style={{ color: '#666', marginBottom: 40, fontSize: 16 }}>{t('tuto_sub')}</p>

      {/* Étape 1 */}
      <div style={{ background: 'white', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>1</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>Créez votre compte Memorabilius</h2>
        </div>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: 16 }}>Inscrivez-vous gratuitement avec votre email et choisissez un pseudo.</p>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid #eee' }}>
          <img src="/tuto/tuto5.png" alt="Formulaire d'inscription" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/sinscrire" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          👉 Créer mon compte →
        </Link>
      </div>

      {/* Étape 2 */}
      <div style={{ background: 'white', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>2</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>Préparez votre Google Sheet</h2>
        </div>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: 12 }}>Utilisez notre modèle pré-rempli. Complétez chaque colonne sans modifier l'en-tête.</p>
        <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 8, padding: 12, fontSize: 13, color: '#7a6000', marginBottom: 16 }}>
          💡 Je conseille ImgBB pour l'hébergement de vos scans. Rognez vos cartes et sélectionnez bien "Lien Direct"
        </div>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid #eee' }}>
          <img src="/tuto/tuto2.png" alt="Google Sheet modèle" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <a href="https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy" target="_blank" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          👉 Obtenir la feuille Google Sheets
        </a>
        <div>
          <a href="https://drive.google.com/file/d/1bJklGgu2n-seeWdWixOy-FaGmSPwRx1W/view?usp=sharing" style={{ display: 'inline-block', background: '#f0f0f0', color: '#333', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            💾 Télécharger le programme d'automatisation d'importation des scans
          </a>
        </div>
      </div>

      {/* Étape 3 */}
      <div style={{ background: 'white', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>3</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>Obtenez votre lien CSV</h2>
        </div>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: 16 }}>Dans Google Sheets : <strong>Fichier / Partager / Publier sur le web</strong> → choisissez "Valeurs séparées par des virgules (.CSV)".</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid #eee' }}>
            <img src="/tuto/tuto3.png" alt="Fichier Partager" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
          <div style={{ flex: 1, minWidth: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid #eee' }}>
            <img src="/tuto/tuto4.png" alt="Publier CSV" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>
      </div>

      {/* Étape 4 */}
      <div style={{ background: 'white', borderRadius: 16, padding: 32, marginBottom: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>4</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>Collez le lien dans votre profil</h2>
        </div>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: 16 }}>Rendez-vous dans votre profil Memorabilius, collez le lien CSV. Votre galerie est générée instantanément !</p>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid #eee' }}>
          <img src="/tuto/tuto1.png" alt="Coller le lien" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/profil" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          👉 Aller dans mon profil →
        </Link>
      </div>
    </div>
  )
}
