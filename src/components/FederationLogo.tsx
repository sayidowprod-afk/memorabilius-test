// Affiche un logo « Fédération de la carte » en recadrant, PUREMENT EN CSS, la
// zone utile de l'image (les fichiers d'origine ont l'emblème/le texte au milieu
// d'un grand canevas transparent 5000×5000). Les fichiers ne sont jamais modifiés.

const CANVAS = 5000
// [x0, y0, largeur, hauteur] de la zone utile mesurée dans chaque image
const BOXES: Record<string, [number, number, number, number]> = {
  emblem: [1224, 336, 2552, 4328],  // federation-carte.png  (emblème seul)
  footer: [508, 1868, 3984, 1260],  // federation-carte-footer.png (emblème + texte)
}
const SRC: Record<string, string> = {
  emblem: '/federation-carte.png',
  footer: '/federation-carte-footer.png',
}

export default function FederationLogo({
  variant = 'emblem',
  height = 34,
  alt = 'Fédération de la carte',
}: {
  variant?: 'emblem' | 'footer'
  height?: number
  alt?: string
}) {
  const [x0, y0, ew, eh] = BOXES[variant]
  const scale = height / eh
  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        width: Math.round(ew * scale),
        height,
        flexShrink: 0,
        backgroundImage: `url(${SRC[variant]})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${Math.round(CANVAS * scale)}px ${Math.round(CANVAS * scale)}px`,
        backgroundPosition: `-${Math.round(x0 * scale)}px -${Math.round(y0 * scale)}px`,
      }}
    />
  )
}
