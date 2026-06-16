'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Profile { display_name: string; avatar_url: string | null; slug: string | null }
interface CommentRow {
  id: string; message: string; created_at: string
  author_id: string; parent_id: string | null
  profiles: Profile | null
}
interface Comment extends CommentRow {
  likes: number; liked: boolean; replies: Comment[]
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${Math.floor(hours / 24)}j`
}

const Avatar = ({ profile, accent, size = 36 }: { profile: Profile | null; accent: string; size?: number }) => (
  profile?.avatar_url
    ? <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44, flexShrink: 0 }}>👤</div>
)

function CommentItem({
  comment, accent, currentUserId, isOwner, onDelete, onLike, onReply, depth = 0
}: {
  comment: Comment; accent: string; currentUserId: string | null
  isOwner: boolean; onDelete: (id: string) => void
  onLike: (id: string, liked: boolean) => void
  onReply: (parentId: string, message: string) => void
  depth?: number
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyMsg, setReplyMsg] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!replyMsg.trim()) return
    setSending(true)
    await onReply(comment.id, replyMsg.trim())
    setReplyMsg('')
    setReplyOpen(false)
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Link href={`/galerie/${comment.profiles?.slug || comment.author_id}`}>
        <Avatar profile={comment.profiles} accent={accent} size={depth > 0 ? 28 : 36} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: 'white', borderRadius: 12, padding: '10px 14px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={`/galerie/${comment.profiles?.slug || comment.author_id}`} style={{ fontWeight: 800, fontSize: 13, color: '#333', textDecoration: 'none' }}>
                {comment.profiles?.display_name || 'Collectionneur'}
              </Link>
              <span style={{ fontSize: 11, color: '#bbb' }}>{timeAgo(comment.created_at)}</span>
            </div>
            {(isOwner || currentUserId === comment.author_id) && (
              <button onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>✕</button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.5, wordBreak: 'break-word' }}>{comment.message}</p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4 }}>
          <button onClick={() => currentUserId && onLike(comment.id, comment.liked)} style={{
            background: 'none', border: 'none', cursor: currentUserId ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 700,
            color: comment.liked ? '#e74c3c' : '#bbb',
            padding: 0,
          }}>
            {comment.liked ? '❤️' : '🤍'} {comment.likes > 0 && comment.likes}
          </button>
          {currentUserId && depth === 0 && (
            <button onClick={() => setReplyOpen(!replyOpen)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: replyOpen ? accent : '#bbb', padding: 0,
            }}>
              Répondre
            </button>
          )}
        </div>

        {/* Formulaire réponse */}
        {replyOpen && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input
              autoFocus
              value={replyMsg}
              onChange={e => setReplyMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } if (e.key === 'Escape') setReplyOpen(false) }}
              placeholder="Votre réponse..."
              maxLength={500}
              style={{
                flex: 1, border: '1px solid #eee', borderRadius: 8, padding: '8px 12px',
                fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            />
            <button onClick={send} disabled={sending || !replyMsg.trim()} style={{
              background: replyMsg.trim() ? accent : '#ddd', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: 12, cursor: replyMsg.trim() ? 'pointer' : 'default', flexShrink: 0,
            }}>↩</button>
          </div>
        )}

        {/* Réponses */}
        {comment.replies.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} accent={accent} currentUserId={currentUserId}
                isOwner={isOwner} onDelete={onDelete} onLike={onLike} onReply={onReply} depth={1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GalerieComments({ galerieUserId, accent, isOwner }: { galerieUserId: string; accent: string; isOwner: boolean }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [message, setMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
    load()
  }, [galerieUserId])

  const load = async () => {
    const [{ data: rows }, { data: likes }] = await Promise.all([
      supabase.from('galerie_comments')
        .select('*, profiles(display_name, avatar_url, slug)')
        .eq('galerie_user_id', galerieUserId)
        .order('created_at', { ascending: true }),
      supabase.from('galerie_comment_likes').select('comment_id, user_id'),
    ])

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id || null

    const likesByComment = new Map<string, { count: number; liked: boolean }>()
    for (const l of likes || []) {
      const e = likesByComment.get(l.comment_id) || { count: 0, liked: false }
      e.count++
      if (l.user_id === uid) e.liked = true
      likesByComment.set(l.comment_id, e)
    }

    const allComments: Comment[] = (rows || []).map((r: any) => ({
      ...r,
      likes: likesByComment.get(r.id)?.count || 0,
      liked: likesByComment.get(r.id)?.liked || false,
      replies: [],
    }))

    const map = new Map(allComments.map(c => [c.id, c]))
    const roots: Comment[] = []
    for (const c of allComments) {
      if (c.parent_id && map.has(c.parent_id)) map.get(c.parent_id)!.replies.push(c)
      else if (!c.parent_id) roots.push(c)
    }
    setComments(roots.reverse())
  }

  const send = async () => {
    if (!message.trim() || !currentUserId) return
    setSending(true)
    await supabase.from('galerie_comments').insert({ galerie_user_id: galerieUserId, author_id: currentUserId, message: message.trim() })
    setMessage('')
    setSending(false)
    load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('galerie_comments').delete().eq('id', id)
    load()
  }

  const handleLike = async (id: string, liked: boolean) => {
    if (!currentUserId) return
    if (liked) await supabase.from('galerie_comment_likes').delete().eq('comment_id', id).eq('user_id', currentUserId)
    else await supabase.from('galerie_comment_likes').insert({ comment_id: id, user_id: currentUserId })
    setComments(prev => {
      const toggle = (cs: Comment[]): Comment[] => cs.map(c => {
        if (c.id === id) return { ...c, liked: !liked, likes: c.likes + (liked ? -1 : 1) }
        return { ...c, replies: toggle(c.replies) }
      })
      return toggle(prev)
    })
  }

  const handleReply = async (parentId: string, msg: string) => {
    if (!currentUserId) return
    await supabase.from('galerie_comments').insert({ galerie_user_id: galerieUserId, author_id: currentUserId, message: msg, parent_id: parentId })
    load()
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {currentUserId && (
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Laisser un commentaire..."
            maxLength={500}
            rows={3}
            style={{
              width: '100%', border: '1px solid #eee', borderRadius: 10, padding: '10px 14px',
              fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>{message.length}/500</span>
            <button onClick={send} disabled={sending || !message.trim()} style={{
              background: message.trim() ? accent : '#ddd', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 20px', fontWeight: 800, fontSize: 13, cursor: message.trim() ? 'pointer' : 'default',
            }}>
              {sending ? 'Envoi...' : 'Commenter'}
            </button>
          </div>
        </div>
      )}

      {!currentUserId && (
        <div style={{ textAlign: 'center', padding: '20px', marginBottom: 20, background: '#f8f8f8', borderRadius: 12 }}>
          <span style={{ fontSize: 13, color: '#999' }}>
            <Link href="/connexion" style={{ color: accent, fontWeight: 700 }}>Connectez-vous</Link> pour commenter ou liker
          </span>
        </div>
      )}

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ccc' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <p style={{ fontWeight: 700 }}>Aucun commentaire</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Soyez le premier à commenter cette galerie</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} accent={accent} currentUserId={currentUserId}
              isOwner={isOwner} onDelete={handleDelete} onLike={handleLike} onReply={handleReply} />
          ))}
        </div>
      )}
    </div>
  )
}
