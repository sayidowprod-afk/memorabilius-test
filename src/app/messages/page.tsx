'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toParam = searchParams.get('to')
  const tradeParam = searchParams.get('trade')

  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(toParam)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [profiles, setProfiles] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [trade, setTrade] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      await loadConversations(data.user.id)
      if (toParam) loadMessages(data.user.id, toParam)
      if (tradeParam) {
        const { data: t } = await supabase.from('trades').select('*').eq('id', parseInt(tradeParam)).single()
        if (t) setTrade(t)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async (uid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('from_user_id, to_user_id, contenu, created_at, lu')
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`)
      .order('created_at', { ascending: false })

    if (!data) return

    // Grouper par interlocuteur
    const convMap: Record<string, any> = {}
    for (const msg of data) {
      const otherId = msg.from_user_id === uid ? msg.to_user_id : msg.from_user_id
      if (!convMap[otherId]) {
        convMap[otherId] = { lastMsg: msg.contenu, date: msg.created_at, unread: 0 }
      }
      if (!msg.lu && msg.to_user_id === uid) convMap[otherId].unread++
    }

    // Charger les profils
    const ids = Object.keys(convMap)
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      const profMap: Record<string, any> = {}
      profs?.forEach(p => { profMap[p.id] = p })
      setProfiles(profMap)
    }

    setConversations(Object.entries(convMap).map(([id, v]) => ({ id, ...v })))
  }

  const loadMessages = async (uid: string, otherId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${uid},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${uid})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])

    // Marquer comme lus
    await supabase.from('messages').update({ lu: true }).eq('to_user_id', uid).eq('from_user_id', otherId)

    // Charger le profil si pas encore chargé
    if (!profiles[otherId]) {
      const { data: p } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', otherId).single()
      if (p) setProfiles(prev => ({ ...prev, [otherId]: p }))
    }
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !userId || !activeConv) return
    await supabase.from('messages').insert({
      from_user_id: userId,
      to_user_id: activeConv,
      contenu: newMsg.trim(),
      trade_id: tradeParam ? parseInt(tradeParam) : null,
    })
    setNewMsg('')
    loadMessages(userId, activeConv)
    loadConversations(userId)
  }

  const selectConv = (id: string) => {
    setActiveConv(id)
    if (userId) loadMessages(userId, id)
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', fontFamily: 'Inter, sans-serif', height: 'calc(100vh - 120px)', display: 'flex', gap: 20 }}>
      <style>{`
        @media (max-width: 768px) {
          .msg-layout { flex-direction: column !important; height: calc(100vh - 80px) !important; gap: 0 !important; }
          .msg-list { width: 100% !important; display: ${activeConv ? 'none' : 'flex'} !important; border-radius: 12px 12px 0 0 !important; }
          .msg-chat { display: ${activeConv ? 'flex' : 'none'} !important; border-radius: 0 0 12px 12px !important; }
        }
      `}</style>

      <div className="msg-layout" style={{ maxWidth: 1000, width: '100%', margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', gap: 20 }}>
      {/* Liste conversations */}
      <div className="msg-list" style={{ width: 280, background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0 }}>Messages</h2>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations.length === 0 && (
            <p style={{ padding: 20, color: '#bbb', fontSize: 13, textAlign: 'center' }}>Aucune conversation</p>
          )}
          {conversations.map(conv => (
            <div key={conv.id} onClick={() => selectConv(conv.id)} style={{
              padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
              background: activeConv === conv.id ? '#f0f4ff' : 'white',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <img src={profiles[conv.id]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[conv.id]?.display_name || 'U')}&background=003DA6&color=fff`}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 13, margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{profiles[conv.id]?.display_name || '...'}</span>
                  {conv.unread > 0 && <span style={{ background: '#003DA6', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{conv.unread}</span>}
                </p>
                <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.lastMsg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone messages */}
      <div className="msg-chat" style={{ flex: 1, background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
            <p>Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Header avec bouton retour mobile */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#003DA6', padding: '0 8px 0 0', fontWeight: 700 }} className="msg-back">←</button>
              <img src={profiles[activeConv]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[activeConv]?.display_name || 'U')}&background=003DA6&color=fff`}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{profiles[activeConv]?.display_name}</p>
                {trade && <p style={{ fontSize: 11, color: '#003DA6', margin: 0 }}>Re: {trade.titre}</p>}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(msg => {
                const isMe = msg.from_user_id === userId
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? '#003DA6' : '#f0f0f0',
                      color: isMe ? 'white' : '#121212',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      <p style={{ margin: 0 }}>{msg.contenu}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.6, textAlign: 'right' }}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Votre message..."
                style={{ flex: 1 }}
              />
              <button onClick={sendMessage} style={{
                background: '#003DA6', color: 'white', border: 'none',
                padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer'
              }}>Envoyer</button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}

export default function Messages() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>}>
      <MessagesContent />
    </Suspense>
  )
}
