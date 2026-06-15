import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    // Roboflow inference API — retourne des coordonnées centrées (x, y = centre du bbox)
    const res = await fetch(
      `https://detect.roboflow.com/memorabilius-card-detector/1?api_key=${apiKey}&confidence=40`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: imageBase64,
      }
    )

    if (!res.ok) return NextResponse.json({ error: 'roboflow error' }, { status: 500 })

    const data = await res.json()
    const preds = data.predictions ?? []
    if (preds.length === 0) return NextResponse.json({ error: 'aucune carte détectée' }, { status: 404 })

    // Prend la carte la plus grande (= carte principale que l'utilisateur veut scanner)
    const best = preds.reduce((a: any, b: any) => (b.width * b.height > a.width * a.height ? b : a))

    // Roboflow retourne x/y = centre, width/height = dimensions
    const { x, y, width, height } = best
    return NextResponse.json({
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      confidence: best.confidence,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
