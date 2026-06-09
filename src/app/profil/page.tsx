'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Profil() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', lien_csv: '', couleur_bordure: '#003DA6', lien_logo: '', instagram: '', twitter: '', discord: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [csvLinked, setCsvLinked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setForm({
          display_name: p.display_name || '',
          lien_csv: p.lien_csv || '',
          couleur_bordure: p.couleur_bordure || '#003DA6',
          lien_logo: p.lien_logo || '',
          instagram: p.instagram || '',
          twitter: p.twitter || '',
          discord: p.discord || '',
        })
        setCsvLinked(!!p.lien_csv)
        setAvatarUrl(p.avatar_url || null)
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    // Vérifications
    if (file.size > 2 * 1024 * 1024) { alert('Image trop lourde (max 2 Mo)'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { alert('Format accepté : JPG, PNG, WEBP'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    // Upload dans Supabase Storage
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (upErr) { alert('Erreur upload : ' + upErr.message); setUploading(false); return }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + '?t=' + Date.now()

    // Sauvegarder dans le profil
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name,
      lien_csv: form.lien_csv,
      couleur_bordure: form.couleur_bordure,
      lien_logo: form.lien_logo,
      instagram: form.instagram,
      twitter: form.twitter,
      discord: form.discord,
    }).eq('id', userId)

    if (!error) {
      setCsvLinked(!!form.lien_csv)
      // Recalculer les stats en arrière-plan
      if (form.lien_csv) {
        fetch('/api/update-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, csvUrl: form.lien_csv }),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert('Erreur : ' + error.message)
    }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>Mon profil</h1>

      {csvLinked ? (
        <div style={{ background: '#eef2f7', borderLeft: '4px solid #2ecc71', padding: 15, borderRadius: 8, marginBottom: 24 }}>
          <strong style={{ color: '#2ecc71' }}>Statut :</strong> Collection synchronisée 🟢
          {userId && <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, marginLeft: 12 }}>Voir ma galerie →</Link>}
        </div>
      ) : (
        <div style={{ background: '#fff5f5', borderLeft: '4px solid #e74c3c', padding: 15, borderRadius: 8, marginBottom: 24 }}>
          <strong style={{ color: '#e74c3c' }}>Statut :</strong> Aucune collection liée 🔴
          <p style={{ margin: '5px 0 0', fontSize: 12, color: '#666' }}>Ajoutez votre lien CSV ci-dessous pour activer votre galerie.</p>
        </div>
      )}

      {/* Avatar */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 16 }}>Photo de profil</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <img
              src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }}
              alt="Avatar"
            />
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: 11 }}>...</span>
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'block', marginBottom: 6 }}
            >
              {uploading ? 'Upload en cours...' : '📷 Changer ma photo'}
            </button>
            <p style={{ fontSize: 11, color: '#999', margin: 0 }}>JPG, PNG ou WEBP · Max 2 Mo</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Pseudo</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Votre pseudo" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Lien CSV Google Sheets</label>
            <input value={form.lien_csv} onChange={e => setForm({ ...form, lien_csv: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Fichier &gt; Partager &gt; Publier sur le web &gt; CSV</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>URL de votre logo (galerie)</label>
            <input value={form.lien_logo} onChange={e => setForm({ ...form, lien_logo: e.target.value })} placeholder="https://..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Instagram</label>
              <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@pseudo" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Twitter / X</label>
              <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="@pseudo" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Discord</label>
              <input value={form.discord} onChange={e => setForm({ ...form, discord: e.target.value })} placeholder="pseudo#0000" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Couleur des bordures</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={form.couleur_bordure} onChange={e => setForm({ ...form, couleur_bordure: e.target.value })} style={{ width: 50, height: 40, padding: 2, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#666' }}>{form.couleur_bordure}</span>
            </div>
          </div>
          <button type="submit" className="btn-main btn-primary" style={{ background: saved ? '#2ecc71' : undefined, borderColor: saved ? '#2ecc71' : undefined }}>
            {saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
          </button>
        </form>
      </div>
    </div>
  )
}
