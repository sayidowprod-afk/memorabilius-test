'use client'
import { useState, use, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import CardScanner from '@/components/CardScanner'
import CameraCapture from '@/components/CameraCapture'
import CollectionTagSelect from '@/components/CollectionTagSelect'

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
  const [previewIL, setPreviewIL] = useState<string | null>(null)
  const [previewIR, setPreviewIR] = useState<string | null>(null)
  const [uploadingIL, setUploadingIL] = useState(false)
  const [uploadingIR, setUploadingIR] = useState(false)
  const [form, setForm] = useState({
    nom: '', equipe: '', annee: '', marque: '', collection: '', variation: '',
    grade: 'Raw', num: '', card_number: '', rc: false, auto: false, patch: false, booklet: false, is_horizontal: false, collection_tag: '',
    image_recto: '', image_verso: '', image_interieur_gauche: '', image_interieur_droite: '',
  })

  type Side = 'recto' | 'verso' | 'il' | 'ir'
  const [scannerModal, setScannerModal] = useState<{ side: Side; src: string; frameRect?: { x: number; y: number; w: number; h: number } } | null>(null)
  const [cameraModal, setCameraModal] = useState<Side | null>(null)
  const [cropModal, setCropModal] = useState<{ side: Side; src: string } | null>(null)
  const [rotation, setRotation] = useState(0)

  // Image pan/zoom state (image moves under fixed frame)
  const [imgTransform, setImgTransform] = useState({ x: 0, y: 0, scale: 1 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Touch/drag refs
  const lastPointer = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const isDragging = useRef(false)
  const rotationRef = useRef(rotation)
  useEffect(() => { rotationRef.current = rotation }, [rotation])
  const cropRatioRef = useRef(CARD_RATIO)
  const isHorizontalRef = useRef(false)
  useEffect(() => { isHorizontalRef.current = form.is_horizontal }, [form.is_horizontal])

  const resetTransform = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return
    const img = imgRef.current
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight

    const frameW = cropRatioRef.current > 1
      ? Math.min(cw * 0.90, ch * 0.82 * cropRatioRef.current)
      : Math.min(cw * 0.82, ch * 0.90 * cropRatioRef.current)
    const frameH = frameW / cropRatioRef.current

    const angleRad = (rotationRef.current * Math.PI) / 180
    const absCos = Math.abs(Math.cos(angleRad))
    const absSin = Math.abs(Math.sin(angleRad))

    const displayW = img.width
    const displayH = img.height

    const scaleW = frameW / (displayW * absCos + displayH * absSin)
    const scaleH = frameH / (displayW * absSin + displayH * absCos)
    const scale = Math.max(scaleW, scaleH)

    setImgTransform({ x: 0, y: 0, scale })
  }, [])

  useEffect(() => {
    if (scannerModal && (scannerModal.side === 'il' || scannerModal.side === 'ir')) {
      setCropModal({ side: scannerModal.side, src: scannerModal.src })
      setRotation(0)
      setImgTransform({ x: 0, y: 0, scale: 1 })
      setScannerModal(null)
    }
  }, [scannerModal])

  useEffect(() => {
    if (cropModal) {
      cropRatioRef.current = (cropModal.side === 'il' || cropModal.side === 'ir' || isHorizontalRef.current) ? 3.5 / 2.5 : CARD_RATIO
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso' | 'il' | 'ir') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (!reader.result) return
      if (side === 'il' || side === 'ir') {
        setCropModal({ side, src: reader.result as string })
        setRotation(0)
        setImgTransform({ x: 0, y: 0, scale: 1 })
      } else {
        setScannerModal({ side, src: reader.result as string })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  type DupCard = { id: string; nom: string; annee: number | null; marque: string | null; image_recto: string | null }
  const [dupWarning, setDupWarning] = useState<{ cards: DupCard[]; userId: string } | null>(null)
  const rectoBase64Ref = useRef<string | null>(null)

  const uploadBlob = async (blob: Blob, side: 'recto' | 'verso' | 'il' | 'ir') => {
    if (side === 'recto') setUploadingRecto(true)
    else if (side === 'verso') setUploadingVerso(true)
    else if (side === 'il') setUploadingIL(true)
    else setUploadingIR(true)
    setScannerModal(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false)
      router.push('/connexion')
      return
    }

    const path = `cartes/${user.id}/${Date.now()}_${side}.jpg`
    const file = new File([blob], `${Date.now()}_${side}.jpg`, { type: 'image/jpeg' })
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Erreur upload : ' + error.message); setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false); return }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl
    if (side === 'recto') { setForm(f => ({ ...f, image_recto: url })); setPreviewRecto(url); setUploadingRecto(false); analyzeCard(blob, false) }
    else if (side === 'verso') { setForm(f => ({ ...f, image_verso: url })); setPreviewVerso(url); setUploadingVerso(false); analyzeCard(blob, true, rectoBase64Ref.current) }
    else if (side === 'il') { setForm(f => ({ ...f, image_interieur_gauche: url })); setPreviewIL(url); setUploadingIL(false) }
    else { setForm(f => ({ ...f, image_interieur_droite: url })); setPreviewIR(url); setUploadingIR(false) }
  }

  const analyzeCard = async (blob: Blob, isVerso = false, rectoBase64?: string | null) => {
    setScanning(true)
    setScanError(null)
    try {
      const base64 = await new Promise<string>(res => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })

      // Stocker le recto pour usage futur avec le verso
      if (!isVerso) rectoBase64Ref.current = base64

      // Si c'est le verso ET qu'on a le recto → envoyer les deux ensemble
      const body = isVerso && rectoBase64
        ? { imageBase64: rectoBase64, imageBase64Verso: base64, mimeType: 'image/jpeg' }
        : { imageBase64: base64, mimeType: 'image/jpeg' }

      const { data: { session: scanSession } } = await supabase.auth.getSession()
      const resp = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scanSession?.access_token}` },
        body: JSON.stringify(body),
      })
      const card = await resp.json()
      if (!resp.ok || card.error) {
        setScanError(card.error || `Erreur ${resp.status}`)
        return
      }
      setForm(f => ({
        ...f,
        // Verso avec recto : toujours écraser variation/collection/num (le verso fait autorité)
        // Verso seul (sans recto) : ne remplir que les champs vides
        nom:        (isVerso && !rectoBase64 && f.nom)        ? f.nom        : card.nom        || f.nom,
        equipe:     (isVerso && !rectoBase64 && f.equipe)     ? f.equipe     : card.equipe     || f.equipe,
        annee:      (isVerso && !rectoBase64 && f.annee)      ? f.annee      : card.annee      || f.annee,
        marque:     (isVerso && !rectoBase64 && f.marque)     ? f.marque     : card.marque     || f.marque,
        collection: card.collection || f.collection,
        variation:  card.variation  !== undefined ? card.variation : f.variation,
        num:         card.num         || f.num,
        card_number: card.card_number || f.card_number,
        grade:      (isVerso && !rectoBase64 && f.grade !== 'Raw') ? f.grade : card.grade || f.grade,
        rc:         f.rc   || (card.rc   ?? false),
        auto:       f.auto || (card.auto ?? false),
        patch:      f.patch || (card.patch ?? false),
      }))
    } catch (e: any) {
      setScanError(e.message)
    } finally {
      setScanning(false)
    }
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
    const cropRatio = (side === 'il' || side === 'ir' || isHorizontalRef.current) ? 3.5 / 2.5 : CARD_RATIO
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight
    const isH = cropRatio > 1
    const frameW = isH
      ? Math.min(cw * 0.90, ch * 0.82 * cropRatio)
      : Math.min(cw * 0.82, ch * 0.90 * cropRatio)
    const frameH = frameW / cropRatio

    const img = imgRef.current
    const angleRad = (rotation * Math.PI) / 180

    // Reproduire l'état visuel du cadre sur un canvas intermédiaire de la taille du container
    // puis extraire le rectangle du cadre à pleine résolution
    const frameX = (cw - frameW) / 2
    const frameY = (ch - frameH) / 2

    // pixelScale : ratio pixels naturels / pixels CSS, plafonné à 2× le final (600px max → 1200px)
    const cssDisplayedW = img.naturalWidth * imgTransform.scale
    const rawPixelScale = img.naturalWidth / cssDisplayedW
    const pixelScale = Math.min(rawPixelScale, 1200 / frameW)

    const outCanvas = document.createElement('canvas')
    outCanvas.width = Math.round(frameW * pixelScale)
    outCanvas.height = Math.round(frameH * pixelScale)
    const outCtx = outCanvas.getContext('2d')!

    // Même transform que le CSS (translate + rotate + scale), décalé pour ne montrer que le cadre
    outCtx.translate(
      (cw / 2 + imgTransform.x - frameX) * pixelScale,
      (ch / 2 + imgTransform.y - frameY) * pixelScale
    )
    outCtx.rotate(angleRad)
    outCtx.scale(imgTransform.scale * pixelScale, imgTransform.scale * pixelScale)
    outCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

    const finalCanvas = document.createElement('canvas')
    const isLandscape = side === 'il' || side === 'ir' || isHorizontalRef.current
    finalCanvas.width = isLandscape ? 840 : 600
    finalCanvas.height = isLandscape ? 600 : 840
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.drawImage(outCanvas, 0, 0, finalCanvas.width, finalCanvas.height)

    setCropModal(null)

    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false); return }
      await uploadBlob(blob, side)
    }, 'image/jpeg', 0.88)
  }

  const doInsert = async (uid: string) => {
    const { error } = await supabase.from('cartes_manuelles').insert({
      user_id: uid, nom: form.nom, equipe: form.equipe || null, annee: form.annee || null,
      marque: form.marque || null, collection: form.collection || null, variation: form.variation || null, grade: form.grade,
      num: form.num || null, card_number: form.card_number || null,
      rc: form.rc, auto: form.auto, patch: form.patch, booklet: form.booklet, is_horizontal: form.is_horizontal,
      image_recto: form.image_recto || null, image_verso: form.image_verso || null,
      image_interieur_gauche: form.image_interieur_gauche || null,
      image_interieur_droite: form.image_interieur_droite || null,
      collection_tag: form.collection_tag || null,
    })
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    fetch('/api/card-added', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid }) }).catch(() => {})
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/wishlist-notify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          card: { nom: form.nom, annee: form.annee, marque: form.marque, collection: form.collection, variation: form.variation, num: form.num, rc: form.rc, auto: form.auto, patch: form.patch },
          cardUserId: uid,
        }),
      })
    })
    router.push(`/galerie/${userId}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { alert(lang === 'fr' ? 'Le nom est obligatoire' : 'Name is required'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) { router.push('/connexion'); return }

    // Vérifier les doublons potentiels (même nom + même année ou même marque)
    const { data: dups } = await supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto')
      .eq('user_id', user.id)
      .ilike('nom', form.nom.trim())
      .limit(5)

    if (dups && dups.length > 0) {
      setDupWarning({ cards: dups as DupCard[], userId: user.id })
      setSaving(false)
      return
    }

    await doInsert(user.id)
  }

  const ImageUploader = ({ side, label, preview, uploading, aspect }: { side: 'recto' | 'verso' | 'il' | 'ir', label: string, preview: string | null, uploading: boolean, aspect?: string }) => {
    const clearPreview = () => {
      if (side === 'recto') { setForm(f => ({ ...f, image_recto: '' })); setPreviewRecto(null) }
      else if (side === 'verso') { setForm(f => ({ ...f, image_verso: '' })); setPreviewVerso(null) }
      else if (side === 'il') { setForm(f => ({ ...f, image_interieur_gauche: '' })); setPreviewIL(null) }
      else { setForm(f => ({ ...f, image_interieur_droite: '' })); setPreviewIR(null) }
    }
    return (
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{label}</label>
        <div
          style={{ border: '2px dashed #ddd', borderRadius: 12, overflow: 'hidden', aspectRatio: aspect || '2.5/3.5', position: 'relative', cursor: 'pointer', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => document.getElementById(`upload-${side}`)?.click()}
        >
          {preview ? (
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={label} />
          ) : (
            <div style={{ textAlign: 'center', color: '#bbb', padding: 10 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
              <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{uploading ? '...' : (lang === 'fr' ? 'Cliquer pour ajouter' : 'Click to add')}</p>
            </div>
          )}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'white', fontWeight: 700 }}>Upload...</div>
            </div>
          )}
        </div>
        <input id={`upload-${side}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, side)} />
        {!preview && !uploading && (
          <button type="button"
            onClick={() => setCameraModal(side)}
            style={{ marginTop: 6, width: '100%', background: '#f0f4ff', color: '#003DA6', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {lang === 'fr' ? '📸 Prendre une photo' : '📸 Take a photo'}
          </button>
        )}
        {preview && (
          <button type="button" onClick={clearPreview}
            style={{ marginTop: 6, width: '100%', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {lang === 'fr' ? '🗑️ Supprimer' : '🗑️ Remove'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 10px' }}>
      <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>
        ← {lang === 'fr' ? 'Retour à la galerie' : 'Back to gallery'}
      </Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>
        {lang === 'fr' ? '➕ Ajouter une carte' : '➕ Add a card'}
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Toggle Booklet */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => setForm(f => ({ ...f, booklet: !f.booklet }))}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 20, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: form.booklet ? '#7b1fa2' : '#f0f0f0', color: form.booklet ? 'white' : '#555', transition: '0.2s' }}>
            📖 Booklet
          </button>
          {form.booklet && <span style={{ fontSize: 12, color: '#888' }}>{lang === 'fr' ? '4 photos requises (2 couvertures + 2 intérieurs)' : '4 photos required (2 covers + 2 interiors)'}</span>}
        </div>

        {/* Photos couvertures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: form.booklet ? 16 : 24 }}>
          <ImageUploader side="recto" label={lang === 'fr' ? (form.booklet ? 'Couverture avant *' : 'Photo Recto *') : (form.booklet ? 'Front cover *' : 'Front Photo *')} preview={previewRecto} uploading={uploadingRecto} aspect={form.is_horizontal ? '3.5/2.5' : undefined} />
          <ImageUploader side="verso" label={lang === 'fr' ? (form.booklet ? 'Couverture arrière' : 'Photo Verso') : (form.booklet ? 'Back cover' : 'Back Photo')} preview={previewVerso} uploading={uploadingVerso} aspect={form.is_horizontal ? '3.5/2.5' : undefined} />
        </div>

        {/* Photos intérieures (booklet seulement) */}
        {form.booklet && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#7b1fa2', marginBottom: 10 }}>
              📖 {lang === 'fr' ? 'Pages intérieures' : 'Interior pages'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <ImageUploader side="il" label={lang === 'fr' ? 'Page gauche' : 'Left page'} preview={previewIL} uploading={uploadingIL} aspect="3.5/2.5" />
              <ImageUploader side="ir" label={lang === 'fr' ? 'Page droite' : 'Right page'} preview={previewIR} uploading={uploadingIR} aspect="3.5/2.5" />
            </div>
          </div>
        )}

        {scanning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0f7ff', border: '1.5px solid #c0d8ff', borderRadius: 10, padding: '10px 16px', marginBottom: 4 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #003DA6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#003DA6' }}>
              {lang === 'fr' ? 'Analyse IA en cours…' : 'AI analysis in progress…'}
            </span>
          </div>
        )}
        {scanError && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #ffc0c0', borderRadius: 10, padding: '10px 16px', marginBottom: 4, fontSize: 12, color: '#c0392b' }}>
            Analyse IA : {scanError}
          </div>
        )}

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
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Marque' : 'Brand'}</label>
              <input value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} placeholder="Panini, Topps…" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Collection' : 'Set'}</label>
              <input value={form.collection} onChange={e => setForm({ ...form, collection: e.target.value })} placeholder="Prizm, Chrome…" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Variation' : 'Variant'}</label>
              <input value={form.variation} onChange={e => setForm({ ...form, variation: e.target.value })} placeholder="Silver Prizm" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Grade</label>
              <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="Raw, PSA 10, BGS 9.5…" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'N° de carte' : 'Card #'}</label>
              <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} placeholder="48, HTR-IFS, EC-1…" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Numérotation (ex: 48/99)' : 'Numbering (ex: 48/99)'}</label>
              <input value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} placeholder="48/99" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Ma collection (tag perso)' : 'My collection (personal tag)'}
            </label>
            <CollectionTagSelect userId={userId} value={form.collection_tag} onChange={tag => setForm({ ...form, collection_tag: tag })} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>{lang === 'fr' ? 'Caractéristiques' : 'Features'}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { key: 'rc', label: 'RC', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', activeBg: '#2e7d32' },
                { key: 'patch', label: 'PATCH', activeBg: '#1976d2' },
                { key: 'booklet', label: '📖 BOOKLET', activeBg: '#7b1fa2' },
                { key: 'is_horizontal', label: '↔ HORIZONTALE', activeBg: '#0097a7' },
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

      {/* Modal doublon */}
      {dupWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>⚠️</div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#111', margin: '0 0 6px', textAlign: 'center' }}>
              {lang === 'fr' ? 'Carte déjà dans ta galerie ?' : 'Card already in your gallery?'}
            </h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px', textAlign: 'center' }}>
              {lang === 'fr'
                ? `Tu as déjà ${dupWarning.cards.length} carte${dupWarning.cards.length > 1 ? 's' : ''} avec ce nom.`
                : `You already have ${dupWarning.cards.length} card${dupWarning.cards.length > 1 ? 's' : ''} with this name.`}
            </p>
            {/* Aperçu des doublons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              {dupWarning.cards.slice(0, 4).map(c => (
                <div key={c.id} style={{ textAlign: 'center' }}>
                  {c.image_recto
                    ? <img src={c.image_recto} alt={c.nom} style={{ width: 72, height: 100, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                    : <div style={{ width: 72, height: 100, background: '#f0f0f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🃏</div>
                  }
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.annee}{c.marque ? ` · ${c.marque}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setDupWarning(null) }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid #e0e0e0', background: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#333' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={async () => { setDupWarning(null); setSaving(true); await doInsert(dupWarning.userId) }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#003DA6', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                {lang === 'fr' ? 'Ajouter quand même' : 'Add anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cameraModal && (
        <CameraCapture
          ratio={(cameraModal === 'il' || cameraModal === 'ir' || form.is_horizontal) ? 3.5 / 2.5 : undefined}
          onCapture={(blob, frameRect) => {
            const url = URL.createObjectURL(blob)
            setCameraModal(null)
            setScannerModal({ side: cameraModal, src: url, frameRect })
          }}
          onClose={() => setCameraModal(null)}
        />
      )}

      {scannerModal && !(scannerModal.side === 'il' || scannerModal.side === 'ir') && (
        <CardScanner
          src={scannerModal.src}
          frameRect={scannerModal.frameRect}
          onResult={blob => uploadBlob(blob, scannerModal.side)}
          onFallback={() => {
            setCropModal({ side: scannerModal.side, src: scannerModal.src })
            setRotation(0)
            setImgTransform({ x: 0, y: 0, scale: 1 })
            setScannerModal(null)
          }}
          onClose={() => setScannerModal(null)}
        />
      )}

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
            {(() => {
              const isInt = cropModal.side === 'il' || cropModal.side === 'ir'
              const isH = isInt || isHorizontalRef.current
              const ar = isH ? '3.5/2.5' : '2.5/3.5'
              const w = isH ? `min(90%, calc(82vh * ${3.5/2.5}))` : `min(82%, calc(90vh * ${CARD_RATIO}))`
              return (
            <div style={{
              position: 'absolute',
              pointerEvents: 'none',
              width: w,
              aspectRatio: ar,
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
              )
            })()}
          </div>

          {/* Panneau bas */}
          <div style={{ width: '100%', background: '#1a1a1a', padding: '14px 20px 20px', boxSizing: 'border-box' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: '0 0 10px' }}>
              {lang === 'fr'
                ? 'Glissez pour repositionner · Pincez ou molette pour zoomer'
                : 'Drag to reposition · Pinch or scroll to zoom'}
            </p>

            {/* Slider zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', width: 52 }}>
                🔍 {Math.round(imgTransform.scale * 100)}%
              </span>
              <input
                type="range" min="-100" max="200"
                value={Math.round(Math.log2(imgTransform.scale) * 60)}
                onChange={e => {
                  const scale = Math.pow(2, Number(e.target.value) / 60)
                  setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, scale)) }))
                }}
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

            {/* Boutons rotation 90° */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setRotation(r => ((r - 90) % 360))}
                style={{ padding: '7px 18px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ↺ 90°
              </button>
              <button type="button" onClick={() => setRotation(r => ((r + 90) % 360))}
                style={{ padding: '7px 18px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ↻ 90°
              </button>
            </div>

            {/* Slider rotation fine */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', width: 52 }}>🔄 {rotation}°</span>
              <input
                type="range" min="-180" max="180" value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#fff', cursor: 'pointer', height: 4 }}
              />
              <div style={{ width: 68 }} />
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
