'use client'
import { useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

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

  // États pour la modale de recadrage manuel
  const [cropModal, setCropModal] = useState<{ side: 'recto' | 'verso'; src: string } | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [cropArea, setCropArea] = useState({ x: 10, y: 10, width: 60 }) // largeur en %

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        setCropModal({ side, src: reader.result as string })
        setCropArea({ x: 10, y: 10, width: 60 }) // Réinitialiser le cadre
      }
    }
    reader.readAsDataURL(file)
    e.target.value = '' // Reset input pour autoriser le même fichier
  }

  const applyCropAndUpload = async () => {
    if (!cropModal || !imageRef.current) return
    const side = cropModal.side
    
    if (side === 'recto') setUploadingRecto(true)
    else setUploadingVerso(true)
    
    const image = imageRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    // Facteurs d'échelle entre l'image affichée à l'écran et sa vraie taille
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    
    // Ratio cible d'une carte : 2.5 / 3.5
    const targetRatio = 2.5 / 3.5
    
    // Calcul des dimensions du rectangle de rognage
    const cropWidthPx = (cropArea.width / 100) * image.width * scaleX
    const cropHeightPx = cropWidthPx / targetRatio

    const cropXPx = (cropArea.x / 100) * image.width * scaleX
    const cropYPx = (cropArea.y / 100) * image.height * scaleY

    // Dimensions finales de l'image stockée (haute qualité proportionnelle)
    canvas.width = 600
    canvas.height = 840

    ctx.drawImage(
      image,
      cropXPx, cropYPx, cropWidthPx, cropHeightPx, // Zone source découpée
      0, 0, canvas.width, canvas.height // Rendu final sur le canvas
    )

    setCropModal(null)

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setUploadingRecto(false)
        setUploadingVerso(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const path = `cartes/${user.id}/${Date.now()}_${side}.jpg`
      const fileToUpload = new File([blob], `${Date.now()}_${side}.jpg`, { type: 'image/jpeg' })

      const { error } = await supabase.storage.from('avatars').upload(path, fileToUpload, { upsert: true })
      if (error) { 
        alert('Erreur upload : ' + error.message)
        setUploadingRecto(false)
        setUploadingVerso(false)
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
      user_id: user.id,
      nom: form.nom,
      equipe: form.equipe || null,
      annee: form.annee || null,
      collection: form.collection || null,
      variation: form.variation || null,
      grade: form.grade,
      num: form.num || null,
      rc: form.rc,
      auto: form.auto,
      patch: form.patch,
      image_recto: form.image_recto || null,
      image_verso: form.image_verso || null,
    })

    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    router.push(`/galerie/${userId}`)
  }

  const ImageUploader = ({ side, label, preview, uploading }: { side: 'recto' | 'verso', label: string, preview: string | null, uploading: boolean }) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ border: '2px dashed #ddd', borderRadius: 12, overflow: 'hidden', aspectRatio: '2.5/3.5', position: 'relative', cursor: 'pointer', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => document.getElementById(`upload-${side}`)?.click()}>
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
      <input id={`upload-${side}`} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handleFileChange(e, side)} />
      {preview && (
        <button type="button" onClick={() => { setForm(f => ({ ...f, [`image_${side}`]: '' })); side === 'recto' ? setPreviewRecto(null) : setPreviewVerso(null) }}
          style={{ marginTop: 6, width: '100%', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'fr' ? '🗑️ Supprimer' : '🗑️ Remove'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif' }}>
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
          {/* Nom */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Nom du joueur *' : 'Player name *'}
            </label>
            <input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="LeBron James" />
          </div>

          {/* Équipe / Année */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
                {lang === 'fr' ? 'Équipe' : 'Team'}
              </label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder="Lakers" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
                {lang === 'fr' ? 'Année' : 'Year'}
              </label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder="2023-24" />
            </div>
          </div>

          {/* Collection / Variation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
                {lang === 'fr' ? 'Collection / Marque' : 'Brand / Set'}
              </label>
              <input value={form.collection} onChange={e => setForm({ ...form, collection: e.target.value })} placeholder="Panini Prizm" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
                {lang === 'fr' ? 'Variation' : 'Variant'}
              </label>
              <input value={form.variation} onChange={e => setForm({ ...form, variation: e.target.value })} placeholder="Silver Prizm" />
            </div>
          </div>

          {/* Grade / Numérotation */}
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
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
                {lang === 'fr' ? 'Numérotation (ex: 48/99)' : 'Numbering (ex: 48/99)'}
              </label>
              <input value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} placeholder="48/99" />
            </div>
          </div>

          {/* Tags RC / Auto / Patch */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>
              {lang === 'fr' ? 'Caractéristiques' : 'Features'}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'rc', label: 'RC', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', activeBg: '#2e7d32' },
                { key: 'patch', label: 'PATCH', activeBg: '#1976d2' },
              ].map(tag => (
                <button key={tag.key} type="button"
                  onClick={() => setForm({ ...form, [tag.key]: !(form as any)[tag.key] })}
                  style={{
                    padding: '10px 20px', border: 'none', borderRadius: 20, cursor: 'pointer',
                    fontWeight: 900, fontSize: 13, transition: '0.2s',
                    background: (form as any)[tag.key] ? tag.activeBg : '#f0f0f0',
                    color: (form as any)[tag.key] ? 'white' : '#333',
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

      {/* Modale interactive de recadrage manuel */}
      {cropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 16, maxWidth: 500, width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 15px', fontWeight: 800 }}>{lang === 'fr' ? 'Recadrer l\'image manuellement' : 'Crop image manually'}</h3>
            
            {/* Zone de prévisualisation avec le guide de sélection */}
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '55vh', overflow: 'hidden', background: '#222', borderRadius: 8 }}>
              <img ref={imageRef} src={cropModal.src} alt="To crop" style={{ maxWidth: '100%', maxHeight: '55vh', display: 'block', userSelect: 'none' }} />
              
              {/* Box de recadrage manuelle superposée */}
              <div style={{
                position: 'absolute',
                border: '3px solid #003DA6',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                aspectRatio: '2.5/3.5',
                top: `${cropArea.y}%`,
                left: `${cropArea.x}%`,
                width: `${cropArea.width}%`,
                pointerEvents: 'none',
                transition: 'all 0.05s ease'
              }}>
                <div style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.7)' }} />
              </div>
            </div>

            {/* Télécommandes manuelles précises */}
            <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', background: '#f9f9f9', padding: 12, borderRadius: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>📐 {lang === 'fr' ? 'Dimension du cadre' : 'Frame size'}</span>
                <input type="range" min="15" max="100" value={cropArea.width} onChange={e => setCropArea(p => ({ ...p, width: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#003DA6' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>↔️ {lang === 'fr' ? 'Position Horizontale' : 'Horizontal Pos'}</span>
                  <input type="range" min="0" max={Math.max(0, 100 - cropArea.width)} value={cropArea.x} onChange={e => setCropArea(p => ({ ...p, x: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#003DA6' }} />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>↕️ {lang === 'fr' ? 'Position Verticale' : 'Vertical Pos'}</span>
                  <input type="range" min="0" max={80} value={cropArea.y} onChange={e => setCropArea(p => ({ ...p, y: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#003DA6' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setCropModal(null)} style={{ flex: 1, padding: 12, background: '#eee', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#555' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button type="button" onClick={applyCropAndUpload} style={{ flex: 1, padding: 12, background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'fr' ? 'Valider le rognage' : 'Crop & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}