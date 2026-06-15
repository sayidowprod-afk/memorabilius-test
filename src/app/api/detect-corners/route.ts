import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `You are analyzing an image that contains a physical sports/trading card placed on a surface.

Your task: find the exact pixel positions of the 4 corners of the card's outer border, then express them as fractions (0.0 to 1.0) of the image width/height.

The card is a rectangular object with:
- A distinct colored border (often blue, white, gold, silver, or black)
- Sharp straight edges
- It may be slightly tilted or angled — the corners will NOT necessarily be at the image corners
- The background is different from the card (dark surface, table, hand, etc.)

Find where the card's 4 outer corners are. Each corner is where two edges of the card meet at a sharp angle (~90°).

Return ONLY this JSON (no markdown, no explanation):
{"topLeft":{"x":0.12,"y":0.08},"topRight":{"x":0.88,"y":0.06},"bottomRight":{"x":0.90,"y":0.94},"bottomLeft":{"x":0.10,"y":0.96}}

Coordinates: x = fraction of image width (0=left, 1=right), y = fraction of image height (0=top, 1=bottom).
The 4 corners must form a convex quadrilateral matching the card shape.`

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
    const { topLeft, topRight, bottomRight, bottomLeft } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ topLeft, topRight, bottomRight, bottomLeft })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
