'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

const RED = '#C8102E'

interface Trade {
  id: number; type: string; titre: string; joueur: string | null; equipe: string | null
  image_url: string | null; description: string | null; user_id: string; created_at: string
  profiles?: { display_name: string | null; avatar_url: string | null } | null
}

// Trade board scopé à une team (même principe que /trades, visible seulement ici).
export default function TeamTrades({ teamId, currentUser, isMember }: {
  teamId: number; currentUser: string | null; isMember: boolean
}) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [form, setForm] = useState<{ type: 'offre' | 'recherche'; titre: string; description: string; card: PickableCard | null }>({ type: 'offre', titre: '', description: '', card: null })

  const load = async () => {
    const { data } = await supabase.from('trades').select('*, profiles(display_name, avatar_url)').eq('team_id', teamId).neq('statut', 'clos').order('created_at', { ascending: false })
    setTrades((data || []) as any)
    setLoading(false)
  }
  useEffect(() => { load() }, [teamId])

  const submit = async () => {
    if (!form.titre.trim() || !currentUser) { alert('Titre requis'); return }
    const { error } = await supabase.from('trades').insert({
      user_id: currentUser, team_id: teamId, type: form.type, titre: form.titre.trim(),
      joueur: form.card?.nom || null, equipe: form.card?.team || null,
      image_url: form.card?.img || null, description: form.description.trim() || null, statut: 'actif',
    })
    if (error) { alert('Erreur : ' + error.message); return }
    setCreateOpen(false); setForm({ type: 'offre', titre: '', description: '', card: null }); load()
  }

  const closeTrade = async (id: number) => {
    await supabase.from('trades').update({ statut: 'clos' }).eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 30, color: '#bbb' }}>Chargement…</p>

  return (
    <div>
      {isMember && currentUser && (
        <button onClick={() => setCreateOpen(true)} style={{ background: RED, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer', marginBottom: 16 }}>
          🔄 Proposer un trade
        </button>
      )}

      {trades.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: 30 }}>Aucun trade dans cette team pour l'instant.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {trades.map(tr => (
          <div key={tr.id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '8px 14px', background: tr.type === 'offre' ? '#e8f5e9' : '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: tr.type === 'offre' ? '#2e7d32' : '#1976d2' }}>{tr.type === 'offre' ? '📤 Offre' : '📥 Recherche'}</span>
              <span style={{ fontSize: 11, color: '#999' }}>{new Date(tr.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            {tr.image_url && (
              <div style={{ aspectRatio: '2.5/3.5', background: '#f2f2f2' }}>
                <img src={tr.image_url} alt={tr.titre} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              </div>
            )}
            <div style={{ padding: 12 }}>
              <h3 style={{ fontWeight: 900, fontSize: 15, margin: '0 0 4px' }}>{tr.titre}</h3>
              {tr.joueur && <p style={{ fontSize: 12, color: RED, fontWeight: 700, margin: '0 0 6px' }}>{tr.joueur}{tr.equipe ? ` · ${tr.equipe}` : ''}</p>}
              {tr.description && <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', lineHeight: 1.4 }}>{tr.description}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {tr.profiles?.avatar_url && <img src={tr.profiles.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{tr.profiles?.display_name || 'Membre'}</span>
                {tr.user_id === currentUser && <button onClick={() => closeTrade(tr.id)} style={{ marginLeft: 'auto', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clore</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div onClick={() => setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🔄 Proposer un trade</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['offre', 'recherche'] as const).map(ty => (
                <button key={ty} onClick={() => setForm({ ...form, type: ty })} style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: form.type === ty ? `2px solid ${RED}` : '2px solid #e0e0e0', background: form.type === ty ? `${RED}0d` : 'white' }}>
                  {ty === 'offre' ? '📤 Offre' : '📥 Recherche'}
                </button>
              ))}
            </div>
            <input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Titre (ex: LeBron Prizm RC /99)" />
            <button onClick={() => setPicking(true)} style={{ padding: 10, borderRadius: 10, border: '2px dashed #ccc', background: '#fafafa', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              {form.card ? <><img src={form.card.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} /> {form.card.nom || 'Carte choisie'}</> : '🃏 Choisir une carte de ma collection'}
            </button>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détails (état, ce que tu cherches en échange…)" rows={3} />
            <button onClick={submit} style={{ background: RED, color: 'white', border: 'none', borderRadius: 10, padding: 12, fontWeight: 800, cursor: 'pointer' }}>Publier</button>
          </div>
        </div>
      )}

      {picking && currentUser && (
        <CardPicker userId={currentUser} onClose={() => setPicking(false)} onSelect={c => { setForm(f => ({ ...f, card: c })); setPicking(false) }} />
      )}
    </div>
  )
}
