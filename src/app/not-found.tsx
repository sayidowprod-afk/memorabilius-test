'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function NotFound() {
  const { t } = useLang()
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🃏</div>
      <h1 style={{ fontWeight: 900, fontSize: 48, color: '#003DA6', marginBottom: 8 }}>404</h1>
      <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 16 }}>{t('not_found_title')}</h2>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 40 }}>{t('not_found_sub')}</p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="btn-main btn-primary">{t('not_found_home')}</Link>
        <Link href="/annuaire" className="btn-main btn-secondary">{t('not_found_directory')}</Link>
      </div>
    </div>
  )
}
