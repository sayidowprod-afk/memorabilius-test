'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

type Request = {
  id: number
  title: string
  description: string | null
  date: string
  city: string
  country: string
  location_name: string | null
  website: string | null
  user_id: string
  status: string
  created_at: string
  profile?: { display_name: string; avatar_url: string | null }
}

type Event = {
  id: number
  title: string
  description: string | null
  date: string
  city: string
  country: string
  location_name: string | null
  website: string | null
  image_url?: string | null
}

export default function AdminEvenements() {
  const { dark } = useTheme()
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualForm, setManualForm] = useState({ title: '', description: '', date: '', city: '', country: 'France', location_name: '', website: '', image_url: '' })
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const editImgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
      if (!p?.is_admin) { router.push('/'); return }
      loadAll()
    })
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: reqs } = await supabase.from('event_requests').select('*').order('created_at', { ascending: false })
    if (reqs && reqs.length > 0) {
      const ids = [...new Set(reqs.map((r: any) => r.user_id))]
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      const profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]))
      setRequests(reqs.map((r: any) => ({ ...r, profile: profMap[r.user_id] })))
    } else {
      setRequests([])
    }
    const { data: evs } = await supabase.from('events').select('*').order('date', { ascending: true })
    setEvents(evs || [])
    setLoading(false)
  }

  const approve = async (req: Request) => {
    await supabase.from('events').insert({
      title: req.title, description: req.description, date: req.date,
      city: req.city, country: req.country, location_name: req.location_name, website: req.website
    })
    await supabase.from('event_requests').update({ status: 'approved' }).eq('id', req.id)
    loadAll()
  }

  const reject = async (req: Request) => {
    await supabase.from('event_requests').update({ status: 'rejected' }).eq('id', req.id)
    loadAll()
  }

  const deleteEvent = async (id: number) => {
    if (!confirm('Supprimer cet événement ?')) return
    await supabase.from('event_attendees').delete().eq('event_id', id)
    await supabase.from('events').delete().eq('id', id)
    loadAll()
  }

  const uploadEventImage = async (file: File): Promise<string | null> => {
    setUploadingImg(true)
    const path = `evenements/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    setUploadingImg(false)
    if (error) { alert('Erreur upload image : ' + error.message); return null }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  const saveEdit = async () => {
    if (!editingEvent) return
    setSaving(true)
    await supabase.from('events').update({
      title: editingEvent.title, description: editingEvent.description, date: editingEvent.date,
      city: editingEvent.city, country: editingEvent.country, location_name: editingEvent.location_name,
      website: editingEvent.website, image_url: editingEvent.image_url
    }).eq('id', editingEvent.id)
    setSaving(false)
    setEditingEvent(null)
    loadAll()
  }

  const addManual = async () => {
    if (!manualForm.title || !manualForm.date || !manualForm.city) return
    setSaving(true)
    await supabase.from('events').insert({ ...manualForm })
    setSaving(false)
    setShowAddManual(false)
    setManualForm({ title: '', description: '', date: '', city: '', country: 'France', location_name: '', website: '', image_url: '' })
    loadAll()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const bg = dark ? '#121212' : '#f7f8fa'
  const card = dark ? '#1e1e1e' : 'white'
  const border = dark ? '#2a2a2a' : '#eee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`,
    background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box'
  }

  const pending = requests.filter(r => r.status === 'pending')
  const processed = requests.filter(r => r.status !== 'pending')

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: text, margin: 0, fontSize: 26, fontWeight: 800 }}>⚙️ Admin — Événements</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAddManual(true)} style={{ padding: '10px 18px', borderRadius: 8, background: '#27ae60', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>+ Ajouter manuellement</button>
            <a href="/evenements" style={{ padding: '10px 18px', borderRadius: 8, background: dark ? '#2a2a2a' : '#eee', color: text, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← Retour</a>
          </div>
        </div>

        {loading ? <p style={{ color: sub }}>Chargement...</p> : (
          <>
            {/* Demandes en attente */}
            <h2 style={{ color: text, fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
              Demandes en attente {pending.length > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: 12, marginLeft: 8 }}>{pending.length}</span>}
            </h2>
            {pending.length === 0 ? (
              <p style={{ color: sub, fontSize: 14, marginBottom: 32 }}>Aucune demande en attente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
                {pending.map(req => (
                  <div key={req.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: text, margin: '0 0 4px', fontWeight: 800, fontSize: 16 }}>{req.title}</p>
                        <p style={{ color: '#003DA6', margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>📅 {formatDate(req.date)} — 📍 {req.city}{req.country !== 'France' ? `, ${req.country}` : ''}</p>
                        {req.location_name && <p style={{ color: sub, margin: '0 0 2px', fontSize: 13 }}>{req.location_name}</p>}
                        {req.description && <p style={{ color: sub, margin: '6px 0 0', fontSize: 13 }}>{req.description}</p>}
                        {req.website && <p style={{ color: sub, margin: '4px 0 0', fontSize: 12 }}>🔗 {req.website}</p>}
                        <p style={{ color: sub, margin: '8px 0 0', fontSize: 12 }}>
                          Par : <strong style={{ color: text }}>{req.profile?.display_name || req.user_id}</strong> · {formatDate(req.created_at)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => approve(req)} style={{ padding: '8px 16px', borderRadius: 8, background: '#27ae60', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>✅ Approuver</button>
                        <button onClick={() => reject(req)} style={{ padding: '8px 16px', borderRadius: 8, background: '#e74c3c', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>✗ Refuser</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Événements publiés */}
            <h2 style={{ color: text, fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Événements publiés ({events.length})</h2>
            {events.length === 0 ? (
              <p style={{ color: sub, fontSize: 14, marginBottom: 32 }}>Aucun événement publié.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
                {events.map(ev => (
                  <div key={ev.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {(ev as any).image_url && <img src={(ev as any).image_url} style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />}
                      <div>
                        <p style={{ color: text, margin: 0, fontWeight: 700 }}>{ev.title}</p>
                        <p style={{ color: sub, margin: '2px 0 0', fontSize: 13 }}>{formatDate(ev.date)} · {ev.city}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingEvent(ev as any)} style={{ padding: '6px 14px', borderRadius: 8, background: 'none', border: `1px solid #003DA6`, color: '#003DA6', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Modifier</button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ padding: '6px 14px', borderRadius: 8, background: 'none', border: `1px solid #e74c3c`, color: '#e74c3c', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Demandes traitées */}
            {processed.length > 0 && (
              <>
                <h2 style={{ color: sub, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Demandes traitées</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
                  {processed.map(req => (
                    <div key={req.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ color: text, margin: 0, fontWeight: 600, fontSize: 14 }}>{req.title}</p>
                        <p style={{ color: sub, margin: '2px 0 0', fontSize: 12 }}>{req.city} · {formatDate(req.date)}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: req.status === 'approved' ? '#27ae60' : '#e74c3c', background: req.status === 'approved' ? '#eafaf1' : '#fdecea', padding: '3px 10px', borderRadius: 10 }}>
                        {req.status === 'approved' ? 'Approuvé' : 'Refusé'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal édition événement */}
      {editingEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditingEvent(null)}>
          <div style={{ background: card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: text, margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>Modifier l'événement</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={inp} placeholder="Nom *" value={editingEvent.title} onChange={e => setEditingEvent(ev => ev ? { ...ev, title: e.target.value } : ev)} />
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Description" value={editingEvent.description || ''} onChange={e => setEditingEvent(ev => ev ? { ...ev, description: e.target.value } : ev)} />
              <input style={inp} type="date" value={editingEvent.date} onChange={e => setEditingEvent(ev => ev ? { ...ev, date: e.target.value } : ev)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={inp} placeholder="Ville *" value={editingEvent.city} onChange={e => setEditingEvent(ev => ev ? { ...ev, city: e.target.value } : ev)} />
                <input style={inp} placeholder="Pays" value={editingEvent.country} onChange={e => setEditingEvent(ev => ev ? { ...ev, country: e.target.value } : ev)} />
              </div>
              <input style={inp} placeholder="Lieu" value={editingEvent.location_name || ''} onChange={e => setEditingEvent(ev => ev ? { ...ev, location_name: e.target.value } : ev)} />
              <input style={inp} placeholder="Site web" value={(editingEvent as any).website || ''} onChange={e => setEditingEvent(ev => ev ? { ...ev, website: e.target.value } : ev)} />
              <div>
                <input ref={editImgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const url = await uploadEventImage(file)
                  if (url) setEditingEvent(ev => ev ? { ...ev, image_url: url } : ev)
                }} />
                {editingEvent.image_url ? (
                  <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={editingEvent.image_url} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => setEditingEvent(ev => ev ? { ...ev, image_url: undefined } : ev)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: 'white', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                    <button type="button" onClick={() => editImgInputRef.current?.click()} style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8, padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Changer</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => editImgInputRef.current?.click()} disabled={uploadingImg} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `2px dashed ${border}`, background: 'none', color: sub, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {uploadingImg ? 'Upload...' : '🖼️ Ajouter une image'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditingEvent(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: text, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                <button onClick={saveEdit} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout manuel */}
      {showAddManual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAddManual(false)}>
          <div style={{ background: card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: text, margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>Ajouter un événement</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={inp} placeholder="Nom *" value={manualForm.title} onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))} />
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Description" value={manualForm.description} onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))} />
              <input style={inp} type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={inp} placeholder="Ville *" value={manualForm.city} onChange={e => setManualForm(f => ({ ...f, city: e.target.value }))} />
                <input style={inp} placeholder="Pays" value={manualForm.country} onChange={e => setManualForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <input style={inp} placeholder="Lieu" value={manualForm.location_name} onChange={e => setManualForm(f => ({ ...f, location_name: e.target.value }))} />
              <input style={inp} placeholder="Site web" value={manualForm.website} onChange={e => setManualForm(f => ({ ...f, website: e.target.value }))} />
              <div>
                <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const url = await uploadEventImage(file)
                  if (url) setManualForm(f => ({ ...f, image_url: url }))
                }} />
                {manualForm.image_url ? (
                  <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={manualForm.image_url} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => setManualForm(f => ({ ...f, image_url: '' }))} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: 'white', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `2px dashed ${border}`, background: 'none', color: sub, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {uploadingImg ? 'Upload...' : '🖼️ Ajouter une image (optionnel)'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddManual(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: text, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                <button onClick={addManual} disabled={saving || !manualForm.title || !manualForm.date || !manualForm.city} style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#27ae60', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Ajout...' : 'Publier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
