'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'

// Préfixe marqueur pour les messages contenant une image (évite une migration de schéma)
const IMG_PREFIX = '[[img]]'
const isImageMsg = (c: string) => typeof c === 'string' && c.startsWith(IMG_PREFIX)
const imgUrlOf = (c: string) => c.slice(IMG_PREFIX.length)

// Réduit une image à 1200px max et l'encode en JPEG pour limiter le poids
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 1200
      let { width, height } = img
      if (width > max || height > max) {
        if (width >= height) { height = Math.round((height * max) / width); width = max }
        else { width = Math.round((width * max) / height); height = max }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('compression échouée'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image illisible')) }
    img.src = url
  })
}

function MessagesContent() {
  const { t } = useLang()
  const { dark } = useTheme()
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
  const [tradesMap, setTradesMap] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState(true)
  const [contextTrade, setContextTrade] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bg = dark ? '#1a1a1a' : 'white'
  const bgPanel = dark ? '#222' : 'white'
  const bgHover = dark ? '#2a2a2a' : '#f0f4ff'
  const border = dark ? '#333' : '#f0f0f0'
  const textMain = dark ? '#fff' : '#121212'
  const textMuted = dark ? '#888' : '#999'
  const bubbleMeBg = '#003DA6'
  const bubbleThemBg = dark ? '#333' : '#f0f0f0'
  const bubbleThemText = dark ? '#fff' : '#121212'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      await loadConversations(data.user.id)
      if (toParam) loadMessages(data.user.id, toParam)
      if (tradeParam) {
        const { data: tr } = await supabase.from('trades').select('*').eq('id', parseInt(tradeParam)).single()
        if (tr) setContextTrade(tr)
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
    const convMap: Record<string, any> = {}
    for (const msg of data) {
      const otherId = msg.from_user_id === uid ? msg.to_user_id : msg.from_user_id
      if (!convMap[otherId]) convMap[otherId] = { lastMsg: msg.contenu, date: msg.created_at, unread: 0 }
      if (!msg.lu && msg.to_user_id === uid) convMap[otherId].unread++
    }
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

    // Charger les trades référencés dans les messages
    const tradeIds = [...new Set((data || []).map((m: any) => m.trade_id).filter(Boolean))] as number[]
    if (tradeIds.length > 0) {
      const { data: trades } = await supabase.from('trades').select('id, titre, type, image_url, joueur').in('id', tradeIds)
      const map: Record<number, any> = {}
      trades?.forEach(tr => { map[tr.id] = tr })
      setTradesMap(map)
    }

    await supabase.from('messages').update({ lu: true }).eq('to_user_id', uid).eq('from_user_id', otherId)
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

  const sendPhoto = async (file: File) => {
    if (!userId || !activeConv) return
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const path = `messages/${userId}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) { alert('Erreur upload : ' + error.message); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('messages').insert({
        from_user_id: userId,
        to_user_id: activeConv,
        contenu: IMG_PREFIX + data.publicUrl,
        trade_id: tradeParam ? parseInt(tradeParam) : null,
      })
      loadMessages(userId, activeConv)
      loadConversations(userId)
    } catch (e: any) {
      alert('Erreur : ' + (e?.message || 'envoi impossible'))
    } finally {
      setUploading(false)
    }
  }

  const selectConv = (id: string) => {
    setActiveConv(id)
    if (userId) loadMessages(userId, id)
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', fontFamily: 'Inter, sans-serif', height: 'calc(100vh - 120px)', display: 'flex', gap: 20, padding: '0 10px' }}>
      <style>{`
        @media (max-width: 768px) {
          .msg-layout { flex-direction: column !important; height: calc(100vh - 80px) !important; gap: 0 !important; }
          .msg-list { width: 100% !important; display: ${activeConv ? 'none' : 'flex'} !important; border-radius: 12px 12px 0 0 !important; }
          .msg-chat { display: ${activeConv ? 'flex' : 'none'} !important; border-radius: 0 0 12px 12px !important; }
        }
      `}</style>

      <div className="msg-layout" style={{ maxWidth: 1000, width: '100%', margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', gap: 20 }}>

        {/* Liste conversations */}
        <div className="msg-list" style={{ width: 280, background: bgPanel, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px', borderBottom: `1px solid ${border}` }}>
            <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0, color: textMain }}>{t('messages_title')}</h2>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {conversations.length === 0 && (
              <p style={{ padding: 20, color: textMuted, fontSize: 13, textAlign: 'center' }}>{t('messages_none')}</p>
            )}
            {conversations.map(conv => (
              <div key={conv.id} onClick={() => selectConv(conv.id)} style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: `1px solid ${border}`,
                background: activeConv === conv.id ? bgHover : 'transparent',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <img src={profiles[conv.id]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[conv.id]?.display_name || 'U')}&background=003DA6&color=fff`}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 13, margin: 0, color: textMain, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{profiles[conv.id]?.display_name || '...'}</span>
                    {conv.unread > 0 && <span style={{ background: '#003DA6', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{conv.unread}</span>}
                  </p>
                  <p style={{ fontSize: 11, color: textMuted, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isImageMsg(conv.lastMsg) ? '📷 Photo' : conv.lastMsg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone messages */}
        <div className="msg-chat" style={{ flex: 1, background: bgPanel, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              <p>{t('messages_select')}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#003DA6', padding: '0 8px 0 0', fontWeight: 700 }} className="msg-back">←</button>
                <div
                  onClick={() => router.push(`/galerie/${activeConv}`)}
                  title="Voir la galerie"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <img src={profiles[activeConv]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[activeConv]?.display_name || 'U')}&background=003DA6&color=fff`}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, margin: 0, color: textMain, textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = textMain)}
                      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                    >{profiles[activeConv]?.display_name}</p>
                    {contextTrade && <p style={{ fontSize: 11, color: '#003DA6', margin: 0 }}>Re: {contextTrade.titre}</p>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map(msg => {
                  const isMe = msg.from_user_id === userId
                  const linkedTrade = msg.trade_id ? tradesMap[msg.trade_id] : null
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMe ? 'flex-end' : 'flex-start' }}>

                        {/* Carte trade attachée */}
                        {linkedTrade && (
                          <a href={`/trades`} style={{ textDecoration: 'none', display: 'block', background: dark ? '#2a3a2a' : '#e8f5e9', border: `1px solid ${dark ? '#3a5a3a' : '#c8e6c9'}`, borderRadius: 10, overflow: 'hidden', width: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                              {linkedTrade.image_url && (
                                <img src={linkedTrade.image_url} alt={linkedTrade.titre} style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: linkedTrade.type === 'offre' ? '#2e7d32' : '#1976d2', marginBottom: 2 }}>
                                  {linkedTrade.type === 'offre' ? '📤 Offre' : '📥 Recherche'}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkedTrade.titre}</div>
                                {linkedTrade.joueur && <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>{linkedTrade.joueur}</div>}
                              </div>
                            </div>
                          </a>
                        )}

                        {/* Bulle de message */}
                        {isImageMsg(msg.contenu) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                            <a href={imgUrlOf(msg.contenu)} target="_blank" rel="noopener noreferrer">
                              <img src={imgUrlOf(msg.contenu)} alt="photo"
                                style={{ maxWidth: 220, maxHeight: 280, borderRadius: 12, display: 'block', objectFit: 'cover' }} />
                            </a>
                            <span style={{ fontSize: 10, color: textMuted }}>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <div style={{
                            padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isMe ? bubbleMeBg : bubbleThemBg,
                            color: isMe ? 'white' : bubbleThemText,
                            fontSize: 13, lineHeight: 1.5,
                          }}>
                            <p style={{ margin: 0 }}>{msg.contenu}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.6, textAlign: 'right' }}>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = '' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Envoyer une photo"
                  style={{
                    background: 'none', border: `1px solid ${border}`, color: '#003DA6',
                    width: 40, height: 40, borderRadius: 8, fontSize: 18, cursor: uploading ? 'default' : 'pointer',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{uploading ? '…' : '📷'}</button>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={t('messages_placeholder')}
                  style={{ flex: 1, background: dark ? '#2a2a2a' : undefined, color: dark ? '#fff' : undefined, borderColor: dark ? '#444' : undefined }}
                />
                <button onClick={sendMessage} style={{
                  background: '#003DA6', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer'
                }}>{t('messages_send')}</button>
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
