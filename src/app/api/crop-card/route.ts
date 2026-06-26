import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await res.json()
  const imageModels = (data.models ?? []).filter((m: any) =>
    m.supportedGenerationMethods?.includes('generateContent') &&
    (m.name?.includes('imagen') || m.name?.includes('flash') || m.name?.includes('image'))
  ).map((m: any) => m.name)
  return NextResponse.json({ imageModels, total: data.models?.length })
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent'

const PROMPT = 'Recadre à ras la carte à collectionner. La carte doit occuper toute l\'image, sans marge blanche, sans fond noir, sans padding. Supprime les reflets et brillances sur la carte.'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: PROMPT }
        ]}],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      })
    })

    const raw = await res.text()

    if (!res.ok) {
      console.error('[crop-card] Gemini error', res.status, raw.slice(0, 300))
      return NextResponse.json({ error: raw }, { status: 502 })
    }

    const data = JSON.parse(raw)
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: any) => p.inlineData?.data)

    if (!imagePart) {
      console.error('[crop-card] pas d\'image dans la réponse Gemini', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ error: 'No image in response' }, { status: 502 })
    }

    return NextResponse.json({ imageBase64: imagePart.inlineData.data })

  } catch (e: any) {
    console.error('[crop-card] exception', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
