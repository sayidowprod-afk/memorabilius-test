import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #003DA6 0%, #001f5c 100%)',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>🃏</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: 'white', letterSpacing: '-2px', marginBottom: 16 }}>
          Memorabilius
        </div>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 700 }}>
          La plateforme ultime pour les collectionneurs de cartes de sport
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
          {['Galeries 3D', 'Trades', 'Teams', 'Communauté'].map(label => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '10px 20px', borderRadius: 50, fontSize: 18, fontWeight: 700 }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
