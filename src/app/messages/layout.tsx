import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Échangez avec les autres collectionneurs de cartes NBA sur Memorabilius.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
