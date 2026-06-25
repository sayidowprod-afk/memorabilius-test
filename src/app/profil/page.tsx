'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import TeamPicker from '@/components/TeamPicker'

export default function Profil() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', bio: '', lien_csv: '', couleur_bordure: '#003DA6', lien_logo: '', instagram: '', twitter: '', discord: '' })
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([])
  const [wrapOptOut, setWrapOptOut] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [csvLinked, setCsvLinked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      // Mettre à jour last_seen
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', data.user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setForm({ display_name: p.display_name || '', bio: p.bio || '', lien_csv: p.lien_csv || '', couleur_bordure: p.couleur_bordure || '#003DA6', lien_logo: p.lien_logo || '', instagram: p.instagram || '', twitter: p.twitter || '', discord: p.discord || '' })
        setFavoriteTeams(Array.isArray(p.favorite_teams) ? p.favorite_teams : [])
        setWrapOptOut(!!p.wrap_opt_out)
        setCsvLinked(!!p.lien_csv)
        setAvatarUrl(p.avatar_url || null)
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { alert('Image trop lourde (max 2 Mo)'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { alert('Erreur upload : ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const slug = form.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + userId.substring(0, 4)

    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name,
      lien_csv: form.lien_csv,
      couleur_bordure: form.couleur_bordure,
      lien_logo: form.lien_logo,
      instagram: form.instagram,
      twitter: form.twitter,
      discord: form.discord,
      bio: form.bio,
      favorite_teams: favoriteTeams,
      wrap_opt_out: wrapOptOut,
      slug,
    }).eq('id', userId)
    if (!error) {
      setCsvLinked(!!form.lien_csv)
      if (form.lien_csv) fetch('/api/update-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, csvUrl: form.lien_csv }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else { alert('Erreur : ' + error.message) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPasswordMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return }
    if (newPassword.length < 8) { setPasswordMsg({ ok: false, text: 'Le mot de passe doit faire au moins 8 caractères.' }); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) { setPasswordMsg({ ok: false, text: error.message }); return }
    setPasswordMsg({ ok: true, text: 'Mot de passe modifié avec succès !' })
    setNewPassword(''); setConfirmPassword('')
    setTimeout(() => { setShowPasswordForm(false); setPasswordMsg(null) }, 2500)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER' || !userId) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/delete-account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ userId }) })
      if (r.ok) { await supabase.auth.signOut(); window.location.href = '/' }
      else { alert('Erreur lors de la suppression'); setDeleting(false) }
    } catch { alert('Erreur'); setDeleting(false) }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>{t('profile_title')}</h1>

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
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 16 }}>{t('profile_photo')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }} alt="Avatar" />
            {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontSize: 11 }}>...</span></div>}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'block', marginBottom: 6 }}>
              {uploading ? (lang === 'fr' ? 'Upload en cours...' : 'Uploading...') : t('profile_change_photo')}
            </button>
            <p style={{ fontSize: 11, color: '#999', margin: 0 }}>JPG, PNG ou WEBP · Max 2 Mo</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_pseudo')}</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Votre pseudo" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Bio</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Décrivez votre collection en quelques mots..." maxLength={200} rows={3} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{form.bio.length}/200 caractères</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_csv_label')}</label>
            <input value={form.lien_csv} onChange={e => setForm({ ...form, lien_csv: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Fichier &gt; Partager &gt; Publier sur le web &gt; CSV</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_logo_label')}</label>
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
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>Équipes favorites (max 5)</label>
            <TeamPicker value={favoriteTeams} onChange={setFavoriteTeams} max={5} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_border')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={form.couleur_bordure} onChange={e => setForm({ ...form, couleur_bordure: e.target.value })} style={{ width: 50, height: 40, padding: 2, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#666' }}>{form.couleur_bordure}</span>
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={!wrapOptOut} onChange={e => setWrapOptOut(!e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#555' }}>
                Recevoir le <strong>Wrap mensuel</strong> par email (résumé de ta collection chaque 1er du mois)
              </span>
            </label>
          </div>
          <button type="submit" className="btn-main btn-primary" style={{ background: saved ? '#2ecc71' : undefined, borderColor: saved ? '#2ecc71' : undefined }}>
            {saved ? t('profile_saved') : t('profile_save')}
          </button>
        </form>
      </div>

      {/* Modifier le mot de passe */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Mot de passe</h3>
        {!showPasswordForm ? (
          <button onClick={() => setShowPasswordForm(true)} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Modifier le mot de passe
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Nouveau mot de passe</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 caractères" autoComplete="new-password" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Confirmer le mot de passe</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Répéter le mot de passe" autoComplete="new-password" />
            </div>
            {passwordMsg && (
              <p style={{ fontSize: 13, color: passwordMsg.ok ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>{passwordMsg.text}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={changingPassword} style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {changingPassword ? 'En cours...' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); setPasswordMsg(null) }} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Zone danger */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #ffebee' }}>
        <h3 style={{ fontWeight: 800, color: '#e74c3c', marginBottom: 8 }}>{t('profile_danger')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>{t('profile_delete_warning')}</p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{ background: '#fff5f5', color: '#e74c3c', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {t('profile_delete')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#e74c3c', fontWeight: 700 }}>Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="SUPPRIMER" style={{ border: '2px solid #e74c3c' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== 'SUPPRIMER' || deleting} style={{
                background: deleteConfirm === 'SUPPRIMER' ? '#e74c3c' : '#f0f0f0',
                color: deleteConfirm === 'SUPPRIMER' ? 'white' : '#999',
                border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13
              }}>
               {deleting ? 'Suppression...' : t('profile_delete_btn')}
              </button>
              <button onClick={() => { setShowDelete(false); setDeleteConfirm('') }} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
