import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg', width, height } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const prompt = `Cette photo montre une carte de collection sportive posée sur une surface (table, bureau, etc.).
La CARTE est plus petite que la photo — ne confonds PAS les bords de la PHOTO avec les bords de la CARTE.

Trouve les 4 coins de la CARTE (rectangle de la carte elle-même, pas de la photo).
Exprime chaque coordonnée en proportion de la taille de l'image, entre 0.0 et 1.0.
Exemple : si la carte occupe le centre et représente 60% de la largeur, x serait entre ~0.20 et ~0.80.

Réponds UNIQUEMENT avec ce JSON, sans markdown :
{"tl":{"x":0.2,"y":0.1},"tr":{"x":0.8,"y":0.1},"br":{"x":0.8,"y":0.9},"bl":{"x":0.2,"y":0.9}}

tl=coin haut-gauche, tr=coin haut-droit, br=coin bas-droit, bl=coin bas-gauche de la CARTE.
Les valeurs sont des proportions (0.0=bord gauche/haut de la photo, 1.0=bord droit/bas).`

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 128, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: any) => p.text ?? '').join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'no json' }, { status: 500 })

    const raw = JSON.parse(match[0])
    const keys = ['tl', 'tr', 'br', 'bl']
    if (!keys.every(k => typeof raw[k]?.x === 'number' && typeof raw[k]?.y === 'number'))
      return NextResponse.json({ error: 'invalid corners' }, { status: 500 })

    // Convertir les proportions en pixels
    const corners = {
      tl: { x: raw.tl.x * width, y: raw.tl.y * height },
      tr: { x: raw.tr.x * width, y: raw.tr.y * height },
      br: { x: raw.br.x * width, y: raw.br.y * height },
      bl: { x: raw.bl.x * width, y: raw.bl.y * height },
    }

    const { tl, tr, br, bl } = corners

    // Rejeter si les coins sont collés aux bords de la photo (= Gemini a sélectionné toute l'image)
    const MARGIN = 0.04 // 4% de marge
    const tooClose = (v: number, max: number) => v < max * MARGIN || v > max * (1 - MARGIN)
    const allEdge = [tl, tr, br, bl].every(p => tooClose(p.x, width) || tooClose(p.y, height))
    if (allEdge) return NextResponse.json({ error: 'sélection trop grande' }, { status: 500 })

    // Rejeter si la zone fait plus de 92% de l'image (probablement toute la photo)
    const area = Math.abs((tr.x - tl.x) * (bl.y - tl.y) - (bl.x - tl.x) * (tr.y - tl.y)) / 2
    if (area > width * height * 0.92)
      return NextResponse.json({ error: 'zone trop grande' }, { status: 500 })

    // Rejeter si la zone fait moins de 5% de l'image (trop petite)
    if (area < width * height * 0.05)
      return NextResponse.json({ error: 'zone trop petite' }, { status: 500 })

    return NextResponse.json(corners)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
