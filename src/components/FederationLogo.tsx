'use client'
import { useState } from 'react'

// Emblème « Fédération de la carte ».
// Utilise /federation-carte.png si le fichier est présent, sinon un emblème de
// secours (repli) pour ne jamais afficher une image cassée.
export default function FederationLogo({ size = 32, title = 'Fédération de la carte' }: { size?: number; title?: string }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src="/federation-carte.png"
        alt={title}
        onError={() => setFailed(true)}
        style={{ height: size, width: 'auto', display: 'block' }}
      />
    )
  }

  // Repli : petit blason bicolore rouge/bleu (le temps d'ajouter le vrai logo)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} style={{ display: 'block' }}>
      <defs>
        <clipPath id="fc-round"><rect x="6" y="6" width="88" height="88" rx="18" /></clipPath>
      </defs>
      <g clipPath="url(#fc-round)">
        <rect x="0" y="0" width="100" height="62" fill="#C8102E" />
        <rect x="0" y="62" width="100" height="38" fill="#1D3F8B" />
        {/* carte tenue en main, stylisée */}
        <rect x="40" y="30" width="26" height="34" rx="3" fill="#fff" transform="rotate(10 53 47)" />
        <rect x="30" y="60" width="40" height="12" rx="6" fill="#fff" />
      </g>
      <rect x="6" y="6" width="88" height="88" rx="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
    </svg>
  )
}
