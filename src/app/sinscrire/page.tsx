'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function Inscription() {
  const { t, lang } = useLang()
  const [form, setForm] = useState({ email: '', password: '', display_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.display_name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/confirm'
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>{t('register_title')}</h1>
        <p style={{ color: '#666', marginBottom: 30, fontSize: 14 }}>{t('register_sub')}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('register_pseudo')}</label>
            <input type="text" required placeholder={lang === 'fr' ? 'Votre pseudo' : 'Your username'} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_email')}</label>
            <input type="email" required placeholder="votre@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={lang === 'fr' ? 'Min. 6 caractères' : 'Min. 6 characters'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? '...' : t('register_btn')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          {t('register_have_account')} <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>{t('register_connect')}</Link>
        </p>
      </div>
    </div>
  )
}
