import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Locate the sports/trading card in this image and return the exact pixel coordinates of its 4 corners.

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "topLeft": {"x": 123, "y": 45},
  "topRight": {"x": 456, "y": 45},
  "bottomRight": {"x": 456, "y": 789},
  "bottomLeft": {"x": 123, "y": 789}
}

Rules:
- Coordinates must be in pixels relative to the original image dimensions
- Find the actual card corners precisely, even if the card is tilted or rotated
- If multiple cards are visible, pick the largest/most prominent one
- If no card is visible, return {"error": "no card found"}`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg', width: imgWidth, height: imgHeight } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 256 }
      })
    })

    const responseText = await res.text()
    console.log('[detect-card] Gemini status:', res.status, 'body:', responseText.slice(0, 500))

    if (!res.ok) return NextResponse.json({ error: 'gemini error', detail: responseText }, { status: 500 })

    const data = JSON.parse(responseText)
    const raw = data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '').join('') ?? ''

    console.log('[detect-card] Gemini raw:', raw.slice(0, 300))

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'pas de JSON dans la réponse' }, { status: 500 })

    const corners = JSON.parse(jsonMatch[0])
    if (corners.error) return NextResponse.json({ error: corners.error }, { status: 404 })

    const { topLeft, topRight, bottomRight, bottomLeft } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({
      corners: { topLeft, topRight, bottomRight, bottomLeft },
      imageSize: { width: imgWidth, height: imgHeight }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
