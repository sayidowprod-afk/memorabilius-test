import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PROMPT = 'Crop tightly around the trading card, removing all background. Remove reflections and glare from the card surface. Show only the card itself, no borders, no surrounding objects.'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const imageBlob = new Blob([imageBuffer], { type: mimeType })

    const formData = new FormData()
    formData.append('image', imageBlob, 'card.jpg')
    formData.append('prompt', PROMPT)
    formData.append('model', 'gpt-image-1')
    formData.append('n', '1')
    formData.append('size', '1024x1024')

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    const raw = await res.text()

    if (!res.ok) {
      console.error('[crop-card] OpenAI error', res.status, raw)
      return NextResponse.json({ error: raw }, { status: 502 })
    }

    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'invalid JSON from OpenAI' }, { status: 502 })
    }

    const item = parsed.data?.[0]

    // gpt-image-1 retourne b64_json directement ; fallback sur url si absent
    if (item?.b64_json) {
      return NextResponse.json({ imageBase64: item.b64_json })
    }

    if (item?.url) {
      const imgRes = await fetch(item.url)
      if (!imgRes.ok) return NextResponse.json({ error: 'cannot fetch image url' }, { status: 502 })
      const buf = await imgRes.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      return NextResponse.json({ imageBase64: b64 })
    }

    console.error('[crop-card] unexpected response shape', JSON.stringify(parsed).slice(0, 300))
    return NextResponse.json({ error: 'No image in response' }, { status: 502 })

  } catch (e: any) {
    console.error('[crop-card] exception', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
