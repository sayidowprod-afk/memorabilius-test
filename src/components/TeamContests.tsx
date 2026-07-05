'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

const RED = '#C8102E'

interface Contest {
  id: number; title: string; description: string | null
  start_date: string; end_date: string; created_by: string | null
}
interface Entry {
  id: number; contest_id: number; user_id: string; card_img: string | null; card_nom: string | null
  profiles?: { display_name: string | null; avatar_url: string | null } | null
}

function statusOf(c: Contest): { key: 'a_venir' | 'en_cours' | 'termine'; label: string; color: string } {
  const now = Date.now(), s = new Date(c.start_date).getTime(), e = new Date(c.end_date).getTime()
  if (now < s) return { key: 'a_venir', label: 'À venir', color: '#e67e22' }
  if (now > e) return { key: 'termine', label: 'Terminé', color: '#888' }
  return { key: 'en_cours', label: 'En cours', color: '#2e7d32' }
}
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TeamContests({ teamId, currentUser, isChef, isMember }: {
  teamId: number; currentUser: string | null; isChef: boolean; isMember: boolean
}) {
  const [contests, setContests] = useState<Contest[]>([])
  const [entries, setEntries] = useState<Record<number, Entry[]>>({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', start: '', end: '' })
  const [pickerFor, setPickerFor] = useState<number | null>(null)

  const load = async () => {
    const { data: cs } = await supabase.from('team_contests').select('*').eq('team_id', teamId).order('start_date', { ascending: false })
    setContests(cs || [])
    const ids = (cs || []).map(c => c.id)
    if (ids.length) {
      const { data: es } = await supabase.from('contest_entries').select('*, profiles(display_name, avatar_url)').in('contest_id', ids)
      const map: Record<number, Entry[]> = {}
      for (const e of (es || []) as any[]) { (map[e.contest_id] ||= []).push(e) }
      setEntries(map)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [teamId])

  const createContest = async () => {
    if (!form.title.trim() || !form.start || !form.end) { alert('Titre, date de début et de fin requis'); return }
    const { error } = await supabase.from('team_contests').insert({
      team_id: teamId, title: form.title.trim(), description: form.description.trim() || null,
      start_date: new Date(form.start).toISOString(), end_date: new Date(form.end).toISOString(), created_by: currentUser,
    })
    if (error) { alert('Erreur : ' + error.message); return }
    setCreateOpen(false); setForm({ title: '', description: '', start: '', end: '' }); load()
  }

  const deleteContest = async (id: number) => {
    if (!confirm('Supprimer ce concours et ses participations ?')) return
    await supabase.from('team_contests').delete().eq('id', id); load()
  }

  const participate = async (card: PickableCard) => {
    if (pickerFor == null || !currentUser) return
    const { error } = await supabase.from('contest_entries').insert({
      contest_id: pickerFor, user_id: currentUser, card_key: card.key, card_img: card.img, card_nom: card.nom,
    })
    setPickerFor(null)
    if (error) { alert(error.message.includes('duplicate') ? 'Tu participes déjà à ce concours.' : 'Erreur : ' + error.message); return }
    load()
  }

  const withdraw = async (contestId: number) => {
    if (!currentUser) return
    await supabase.from('contest_entries').delete().eq('contest_id', contestId).eq('user_id', currentUser)
    load()
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 30, color: '#bbb' }}>Chargement…</p>

  return (
    <div>
      {isChef && (
        <button onClick={() => setCreateOpen(true)} style={{ background: RED, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer', marginBottom: 16 }}>
          🏆 Créer un concours
        </button>
      )}

      {contests.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: 30 }}>Aucun concours pour l'instant.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {contests.map(c => {
          const st = statusOf(c)
          const es = entries[c.id] || []
          const mine = es.find(e => e.user_id === currentUser)
          return (
            <div key={c.id} style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', border: `1px solid #eee` }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: st.color, color: 'white', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>{st.label}</span>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: 17 }}>{c.title}</h3>
                  {isChef && <button onClick={() => deleteContest(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 13 }}>🗑️</button>}
                </div>
                {c.description && <p style={{ margin: '6px 0 0', color: '#555', fontSize: 13 }}>{c.description}</p>}
                <p style={{ margin: '6px 0 0', color: '#999', fontSize: 12 }}>Du {fmt(c.start_date)} au {fmt(c.end_date)} · {es.length} participant{es.length > 1 ? 's' : ''}</p>
              </div>

              <div style={{ padding: 14 }}>
                {st.key === 'en_cours' && isMember && currentUser && (
                  mine
                    ? <button onClick={() => withdraw(c.id)} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>Retirer ma participation</button>
                    : <button onClick={() => setPickerFor(c.id)} style={{ background: RED, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>➕ Participer avec une carte</button>
                )}
                {st.key === 'a_venir' && <p style={{ color: '#e67e22', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Le concours n'a pas encore commencé.</p>}

                {es.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                    {es.map(e => (
                      <div key={e.id} style={{ border: e.user_id === currentUser ? `2px solid ${RED}` : '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ aspectRatio: '2.5/3.5', background: '#f2f2f2' }}>
                          {e.card_img && <img src={e.card_img} alt={e.card_nom || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                        </div>
                        <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {e.profiles?.avatar_url && <img src={e.profiles.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />}
                          <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.profiles?.display_name || 'Membre'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>Aucune participation.</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Création (admins) */}
      {createOpen && (
        <div onClick={() => setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🏆 Nouveau concours</h3>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre du concours" />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description / règles (optionnel)" rows={3} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Début</label>
            <input type="datetime-local" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Fin</label>
            <input type="datetime-local" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
            <button onClick={createContest} style={{ background: RED, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 800, cursor: 'pointer' }}>Créer</button>
          </div>
        </div>
      )}

      {pickerFor != null && currentUser && (
        <CardPicker userId={currentUser} onClose={() => setPickerFor(null)} onSelect={participate} />
      )}
    </div>
  )
}
