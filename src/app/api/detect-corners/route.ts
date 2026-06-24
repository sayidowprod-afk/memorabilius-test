import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `You are a precise vision system. Locate the 4 outer corners of a physical trading card in this image.

The card is a thin rectangular object (standard size ~2.5×3.5 inches, aspect ratio ~0.714 portrait or ~1.4 landscape).
It may be slightly tilted or shot at an angle. The card has straight edges and a border. Background is a table, hand, or surface.

Instructions:
1. Identify the outermost boundary of the card (not inner elements like the photo or text).
2. Find the exact 4 corners where the card edges meet at ~90° angles — even if perspective-distorted.
3. Express each corner as a fraction of the image dimensions (x = 0.0 left → 1.0 right, y = 0.0 top → 1.0 bottom).
4. The 4 points must form a convex quadrilateral. Double-check they are the actual card corners, not image corners.
5. Set confidence to your certainty (0.0–1.0) that you found a card with clearly visible corners. Use below 0.6 if blurry, partially occluded, or guessing.

Return ONLY valid JSON, no markdown, no explanation:
{"topLeft":{"x":0.12,"y":0.08},"topRight":{"x":0.88,"y":0.06},"bottomRight":{"x":0.90,"y":0.94},"bottomLeft":{"x":0.10,"y":0.96},"confidence":0.95}`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    const text = await res.text()
    console.log('[detect-corners] Gemini status:', res.status, text.slice(0, 300))
    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = JSON.parse(text)
    const raw = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? ''
    console.log('[detect-corners] raw:', raw.slice(0, 200))

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'pas de JSON' }, { status: 500 })

    const corners = JSON.parse(match[0])
    const { topLeft, topRight, bottomRight, bottomLeft, confidence } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ topLeft, topRight, bottomRight, bottomLeft, confidence: confidence ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
