'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function Connexion() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(lang === 'fr' ? 'Email ou mot de passe incorrect' : 'Incorrect email or password'); setLoading(false); return }
    router.push('/profil')
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>{t('login_title')}</h1>
        <p style={{ color: '#666', marginBottom: 30, fontSize: 14 }}>{lang === 'fr' ? 'Content de vous revoir !' : 'Welcome back!'}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_email')}</label>
            <input type="email" required placeholder="votre@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={lang === 'fr' ? 'Votre mot de passe' : 'Your password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? '...' : t('login_btn')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          {t('login_no_account')} <Link href="/sinscrire" style={{ color: '#003DA6', fontWeight: 700 }}>{t('nav_inscription')}</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13 }}>
          <Link href="/mot-de-passe-oublie" style={{ color: '#999' }}>{t('login_forgot')}</Link>
        </p>
      </div>
    </div>
  )
}
