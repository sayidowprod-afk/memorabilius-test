'use client'
import { useState, use, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

const CARD_RATIO = 2.5 / 3.5

export default function AjouterCarte({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const { lang } = useLang()
  const [saving, setSaving] = useState(false)
  const [uploadingRecto, setUploadingRecto] = useState(false)
  const [uploadingVerso, setUploadingVerso] = useState(false)
  const [previewRecto, setPreviewRecto] = useState<string | null>(null)
  const [previewVerso, setPreviewVerso] = useState<string | null>(null)
  const [form, setForm] = useState({
    nom: '', equipe: '', annee: '', collection: '', variation: '',
    grade: 'Raw', num: '', rc: false, auto: false, patch: false,
    image_recto: '', image_verso: '',
  })

  const [cropModal, setCropModal] = useState<{ side: 'recto' | 'verso'; src: string } | null>(null)
  const [rotation, setRotation] = useState(0)

  // Image pan/zoom state (image moves under fixed frame)
  const [imgTransform, setImgTransform] = useState({ x: 0, y: 0, scale: 1 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Touch/drag refs
  const lastPointer = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const isDragging = useRef(false)

  const resetTransform = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return
    const img = imgRef.current
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight

    // Frame dimensions (mirrors the CSS: min(82% cw, 90vh * CARD_RATIO))
    const frameW = Math.min(cw * 0.82, ch * 0.9 * CARD_RATIO)
    const frameH = frameW / CARD_RATIO

    const angleRad = (rotation * Math.PI) / 180
    const absCos = Math.abs(Math.cos(angleRad))
    const absSin = Math.abs(Math.sin(angleRad))
    const rotW = img.naturalWidth * absCos + img.naturalHeight * absSin
    const rotH = img.naturalWidth * absSin + img.naturalHeight * absCos

    // Display size of the image before transform scale
    const displayW = img.width
    const displayH = img.height

    // Scale so the rotated image fits INSIDE the frame (contain)
    const scaleW = frameW / (displayW * absCos + displayH * absSin)
    const scaleH = frameH / (displayW * absSin + displayH * absCos)
    const scale = Math.min(scaleW, scaleH)

    setImgTransform({ x: 0, y: 0, scale })
  }, [rotation])

  useEffect(() => {
    if (cropModal) {
      setImgTransform({ x: 0, y: 0, scale: 1 })
    }
  }, [cropModal])

  useEffect(() => {
    if (cropModal && imgRef.current?.complete) {
      resetTransform()
    }
  }, [cropModal, resetTransform])

  // Wheel zoom sans scroll de page (passive: false obligatoire)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !cropModal) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * delta)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cropModal])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        setCropModal({ side, src: reader.result as string })
        setRotation(0)
        setImgTransform({ x: 0, y: 0, scale: 1 })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const getDist = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    setImgTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  const handleMouseUp = () => { isDragging.current = false }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      isDragging.current = false
      lastDist.current = getDist(e.touches)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPointer.current.x
      const dy = e.touches[0].clientY - lastPointer.current.y
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setImgTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    } else if (e.touches.length === 2) {
      const dist = getDist(e.touches)
      const delta = dist / lastDist.current
      lastDist.current = dist
      setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * delta)) }))
    }
  }

  const handleTouchEnd = () => { isDragging.current = false }

  const applyCropAndUpload = async () => {
    if (!cropModal || !containerRef.current || !imgRef.current) return
    const side = cropModal.side

    if (side === 'recto') setUploadingRecto(true)
    else setUploadingVerso(true)

    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight

    // Frame dimensions (same as overlay)
    const frameW = Math.min(cw * 0.82, ch * CARD_RATIO * 0.9)
    const frameH = frameW / CARD_RATIO

    const img = imgRef.current

    // Build rotated + scaled canvas
    const angleRad = (rotation * Math.PI) / 180
    const absCos = Math.abs(Math.cos(angleRad))
    const absSin = Math.abs(Math.sin(angleRad))
    const rotW = img.naturalWidth * absCos + img.naturalHeight * absSin
    const rotH = img.naturalWidth * absSin + img.naturalHeight * absCos

    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = rotW
    srcCanvas.height = rotH
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.translate(rotW / 2, rotH / 2)
    srcCtx.rotate(angleRad)
    srcCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

    // The displayed image size after CSS transform (scale)
    const displayedImgW = img.width * imgTransform.scale
    const displayedImgH = img.height * imgTransform.scale

    // Center of container
    const cx = cw / 2
    const cy = ch / 2

    // Image center in container space
    const imgCx = cx + imgTransform.x
    const imgCy = cy + imgTransform.y

    // Frame top-left in container space
    const frameX = cx - frameW / 2
    const frameY = cy - frameH / 2

    // Frame top-left relative to image top-left
    const relX = frameX - (imgCx - displayedImgW / 2)
    const relY = frameY - (imgCy - displayedImgH / 2)

    // Scale factor from displayed image coords to natural canvas coords
    const scaleToCanvas = rotW / displayedImgW

    const cropX = relX * scaleToCanvas
    const cropY = relY * scaleToCanvas
    const cropW = frameW * scaleToCanvas
    const cropH = frameH * scaleToCanvas

    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = 600
    finalCanvas.height = 840
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, 600, 840)

    setCropModal(null)

    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setUploadingRecto(false); setUploadingVerso(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const path = `cartes/${user.id}/${Date.now()}_${side}.jpg`
      const fileToUpload = new File([blob], `${Date.now()}_${side}.jpg`, { type: 'image/jpeg' })

      const { error } = await supabase.storage.from('avatars').upload(path, fileToUpload, { upsert: true })
      if (error) {
        alert('Erreur upload : ' + error.message)
        setUploadingRecto(false); setUploadingVerso(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl

      if (side === 'recto') {
        setForm(f => ({ ...f, image_recto: url }))
        setPreviewRecto(url)
        setUploadingRecto(false)
      } else {
        setForm(f => ({ ...f, image_verso: url }))
        setPreviewVerso(url)
        setUploadingVerso(false)
      }
    }, 'image/jpeg', 0.88)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { alert(lang === 'fr' ? 'Le nom est obligatoire' : 'Name is required'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) { router.push('/connexion'); return }

    const { error } = await supabase.from('cartes_manuelles').insert({
      user_id: user.id, nom: form.nom, equipe: form.equipe || null, annee: form.annee || null,
      collection: form.collection || null, variation: form.variation || null, grade: form.grade,
      num: form.num || null, rc: form.rc, auto: form.auto, patch: form.patch,
      image_recto: form.image_recto || null, image_verso: form.image_verso || null,
    })

    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    router.push(`/galerie/${userId}`)
  }

  const ImageUploader = ({ side, label, preview, uploading }: { side: 'recto' | 'verso', label: string, preview: string | null, uploading: boolean }) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{label}</label>
      <div
        style={{ border: '2px dashed #ddd', borderRadius: 12, overflow: 'hidden', aspectRatio: '2.5/3.5', position: 'relative', cursor: 'pointer', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => document.getElementById(`upload-${side}`)?.click()}
      >
        {preview ? (
          <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={label} />
        ) : (
          <div style={{ textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{uploading ? '...' : (lang === 'fr' ? 'Cliquer pour ajouter' : 'Click to add')}</p>
          </div>
        )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', fontWeight: 700 }}>{lang === 'fr' ? 'Upload...' : 'Uploading...'}</div>
          </div>
        )}
      </div>
      <input id={`upload-${side}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, side)} />
      {preview && (
        <button type="button" onClick={() => { setForm(f => ({ ...f, [`image_${side}`]: '' })); side === 'recto' ? setPreviewRecto(null) : setPreviewVerso(null) }}
          style={{ marginTop: 6, width: '100%', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'fr' ? '🗑️ Supprimer' : '🗑️ Remove'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 10px' }}>
      <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>
        ← {lang === 'fr' ? 'Retour à la galerie' : 'Back to gallery'}
      </Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>
        {lang === 'fr' ? '➕ Ajouter une carte' : '➕ Add a card'}
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <ImageUploader side="recto" label={lang === 'fr' ? 'Photo Recto *' : 'Front Photo *'} preview={previewRecto} uploading={uploadingRecto} />
          <ImageUploader side="verso" label={lang === 'fr' ? 'Photo Verso' : 'Back Photo'} preview={previewVerso} uploading={uploadingVerso} />
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Nom du joueur *' : 'Player name *'}
            </label>
            <input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="LeBron James" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Équipe' : 'Team'}</label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder="Lakers" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Année' : 'Year'}</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder="2023-24" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Collection / Marque' : 'Brand / Set'}</label>
              <input value={form.collection} onChange={e => setForm({ ...form, collection: e.target.value })} placeholder="Panini Prizm" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Variation' : 'Variant'}</label>
              <input value={form.variation} onChange={e => setForm({ ...form, variation: e.target.value })} placeholder="Silver Prizm" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Grade</label>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                {['Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'BGS 10', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5'].map(g => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Numérotation (ex: 48/99)' : 'Numbering (ex: 48/99)'}</label>
              <input value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} placeholder="48/99" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>{lang === 'fr' ? 'Caractéristiques' : 'Features'}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'rc', label: 'RC', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', activeBg: '#2e7d32' },
                { key: 'patch', label: 'PATCH', activeBg: '#1976d2' },
              ].map(tag => (
                <button key={tag.key} type="button" onClick={() => setForm({ ...form, [tag.key]: !(form as any)[tag.key] })}
                  style={{
                    padding: '10px 20px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 900, fontSize: 13, transition: '0.2s',
                    background: (form as any)[tag.key] ? tag.activeBg : '#f0f0f0', color: (form as any)[tag.key] ? 'white' : '#333',
                  }}>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-main btn-primary" style={{ marginTop: 8 }}>
            {saving ? '...' : (lang === 'fr' ? '✅ Ajouter à ma galerie' : '✅ Add to my gallery')}
          </button>
        </div>
      </form>

      {cropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Zone d'interaction : image mobile sous cadre fixe */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              position: 'relative',
              width: '100%',
              flex: 1,
              overflow: 'hidden',
              cursor: isDragging.current ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Image libre (se déplace/zoom) */}
            <img
              ref={imgRef}
              src={cropModal.src}
              alt="To crop"
              onLoad={resetTransform}
              draggable={false}
              style={{
                position: 'absolute',
                maxWidth: 'none',
                transform: `translate(${imgTransform.x}px, ${imgTransform.y}px) scale(${imgTransform.scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                transition: 'none',
              }}
            />

            {/* Overlay sombre autour du cadre */}
            {(() => {
              // Calculate frame dimensions relative to container for overlay cutout
              // We use CSS clip-path on 4 separate divs for the shadow
              return null
            })()}

            {/* Cadre fixe centré — juste les coins, pas de bordure pleine */}
            <div style={{
              position: 'absolute',
              pointerEvents: 'none',
              width: `min(82%, calc(90vh * ${CARD_RATIO}))`,
              aspectRatio: '2.5/3.5',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              borderRadius: 6,
            }}>
              {/* Coins décoratifs blancs */}
              {[
                { top: -2, left: -2, borderTop: '3px solid white', borderLeft: '3px solid white', borderRadius: '4px 0 0 0' },
                { top: -2, right: -2, borderTop: '3px solid white', borderRight: '3px solid white', borderRadius: '0 4px 0 0' },
                { bottom: -2, left: -2, borderBottom: '3px solid white', borderLeft: '3px solid white', borderRadius: '0 0 0 4px' },
                { bottom: -2, right: -2, borderBottom: '3px solid white', borderRight: '3px solid white', borderRadius: '0 0 4px 0' },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...style }} />
              ))}
            </div>
          </div>

          {/* Panneau bas */}
          <div style={{ width: '100%', background: '#1a1a1a', padding: '14px 20px 20px', boxSizing: 'border-box' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: '0 0 12px' }}>
              {lang === 'fr'
                ? 'Glissez pour repositionner · Pincez ou molette pour zoomer'
                : 'Drag to reposition · Pinch or scroll to zoom'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>🔄 {rotation}°</span>
              <input
                type="range" min="-180" max="180" value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#fff', cursor: 'pointer', height: 4 }}
              />
              <button
                type="button"
                onClick={resetTransform}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {lang === 'fr' ? 'Recadrer' : 'Fit'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCropModal(null)}
                style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', color: 'white', fontSize: 15 }}
              >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={applyCropAndUpload}
                style={{ flex: 2, padding: 14, background: 'white', color: '#111', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
              >
                {lang === 'fr' ? 'Utiliser cette image' : 'Use this image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
