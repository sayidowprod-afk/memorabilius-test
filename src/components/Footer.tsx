import Link from 'next/link'
import FederationLogo from '@/components/FederationLogo'

const RED = '#C8102E'

// Icônes réseaux (inline pour éviter des dépendances)
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1 2h6.9l4.8 6.3L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z" /></svg>
  )
}
function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5a15 15 0 0 1 4.3 2.2 16.8 16.8 0 0 0-14.9 0A15 15 0 0 1 8.9 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.7 8.9-.1 13.2.3 17.5a20 20 0 0 0 6 3l.8-1.2a13 13 0 0 1-2-1l.5-.4a14.3 14.3 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 1l.8 1.2a20 20 0 0 0 6-3c.5-5-.8-9.3-2.6-13.1ZM8.3 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()
  const legalLink: React.CSSProperties = { color: 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }
  const social: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white' }

  return (
    <footer style={{ marginTop: 40, background: RED, color: 'white' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '30px 20px 22px', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>

        {/* ── Marque ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <FederationLogo size={78} />
          <div style={{ fontWeight: 900, fontSize: 24, lineHeight: 1.02, letterSpacing: '0.01em' }}>
            FÉDÉRATION<br />DE LA CARTE
          </div>
        </div>

        {/* ── Avantages adhérents ── */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: '0.06em', marginBottom: 8, opacity: 0.95 }}>
            FONCTIONNALITÉS POUR LES ADHÉRENTS :
          </div>
          {/* TODO: personnaliser ces avantages */}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, fontWeight: 600, lineHeight: 1.7 }}>
            <li>Badge exclusif</li>
            <li>Avantage à venir</li>
            <li>Avantage à venir</li>
          </ul>
        </div>

        {/* ── Devenir adhérent ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 16, fontStyle: 'italic' }}>Devenir adhérent →</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="#" aria-label="X" style={social}><XIcon /></a>
            <a href="#" aria-label="Discord" style={social}><DiscordIcon /></a>
          </div>
        </div>
      </div>

      {/* ── Barre légale ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>© {year} Memorabilius</span>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <Link href="/mentions-legales" style={legalLink}>Mentions légales</Link>
            <Link href="/confidentialite" style={legalLink}>Confidentialité</Link>
            <Link href="/cgu" style={legalLink}>CGU</Link>
            <a href="https://ko-fi.com/gknnn_cards" target="_blank" rel="noopener noreferrer" className="kofi-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: RED, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              ☕ Soutenir le projet
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
