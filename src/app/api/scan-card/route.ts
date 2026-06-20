import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer) et TCG (Pokémon, Magic, etc.) avec une connaissance exhaustive des sets, parallèles et variations.

Analyse cette image de carte et extrais les informations en JSON strict.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

{
  "nom": "Nom complet du joueur ou personnage",
  "equipe": "Nom complet ville + surnom (ex: Los Angeles Lakers, Golden State Warriors). Vide si TCG ou non applicable.",
  "annee": "Année ou saison (ex: 2023-24, 2023, 2022)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Leaf, Fleer, Pokémon, Magic)",
  "collection": "Nom du SET principal sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select, Hoops, Donruss, Bowman, Heritage, Stadium Club, National Treasures, Immaculate, Flawless, Obsidian, Revolution, Noir, Illusions, Court Kings)",
  "variation": "Parallèle ou variante EXACTE visible sur la carte (voir guide ci-dessous). Vide si c'est la base standard.",
  "num": "Numérotation sérielle au format X/Y ou /Y si visible et imprimée (ex: 48/99, /25, /10). Vide sinon.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ GUIDE DES VARIATIONS PAR MARQUE ═══

PANINI PRIZM (NBA/NFL/MLB):
Base → variation = ""
Silver Prizm → "Silver Prizm" (holographique argenté, le plus courant)
Red Prizm → "Red Prizm"
Blue Prizm → "Blue Prizm"
Blue Ice Prizm → "Blue Ice Prizm"
Gold Prizm /10 → "Gold Prizm"
Black Prizm /1 → "Black Prizm"
Green Prizm → "Green Prizm"
Purple Prizm → "Purple Prizm"
Pink Prizm → "Pink Prizm"
Orange Prizm → "Orange Prizm"
Red White Blue → "Red White Blue Prizm"
Cracked Ice → "Cracked Ice Prizm"
Hyper → "Hyper Prizm"
Fast Break → "Fast Break Prizm"
Disco → "Disco Prizm"
Gold Vinyl /1 → "Gold Vinyl Prizm"
Mojo → "Mojo Prizm"

PANINI OPTIC:
Base → ""
Holo → "Holo"
Blue → "Blue Optic"
Red → "Red Optic"
Gold /10 → "Gold Optic"
Black /1 → "Black Optic"
Pink → "Pink Optic"
Purple → "Purple Optic"
Green → "Green Optic"
Orange → "Orange Optic"
Pandora → "Pandora"
Velocity → "Velocity"
Shock → "Shock"
Checkerboard → "Checkerboard"
Rated Rookie → note rc=true

PANINI MOSAIC — INSERTS (subsets avec leur propre design/cadre distinct) :
ATTENTION : Mosaic contient beaucoup d'INSERTS qui ont leur propre nom, à ne pas confondre avec les parallèles couleur.
Si le design de la bordure/cadre de la carte est clairement différent du style Mosaic standard (carreaux bleus), c'est probablement un INSERT.

Inserts Mosaic courants :
  Bang! → bordure avec effet d'explosion/éclats, très colorée → variation = "Bang!" (base) ou "Bang! Silver Prizm" (holographique)
  Jam! → joueur qui dunk, bordure dynamique → "Jam!" ou "Jam! Silver Prizm"
  Stained Glass → effet vitrail → "Stained Glass" ou "Stained Glass Silver Prizm"
  Will to Win → design motivationnel → "Will to Win"
  Stare Down → gros plan visage → "Stare Down"
  On the Rise → jeunes joueurs → "On the Rise"
  Magnitude → bordure étoilée → "Magnitude"
  Mosaic Memorabilia → relic → patch=true, "Mosaic Memorabilia"

Parallèles Mosaic (même design de base, couleur différente) :
Base → ""
Silver Prizm → "Silver Mosaic" (holographique argenté)
Pink Camo → "Pink Camo"
Blue → "Blue Mosaic" (teinte bleue uniforme, SANS design d'insert spécial)
Gold → "Gold Mosaic"
Reactive Blue → "Reactive Blue"
Reactive Yellow → "Reactive Yellow"
Camo → "Camo"
Genesis → "Genesis"

RÈGLE CLÉ MOSAIC : Si la carte a un design de cadre/fond DISTINCT du carrelage Mosaic standard → c'est un INSERT, mets le nom de l'insert en variation.
Si c'est juste le design standard Mosaic en couleur différente → c'est un parallèle couleur.
Combinaison possible : insert + parallèle → "Bang! Silver Prizm"

PANINI PRIZM — INSERTS courants :
Prizm contient aussi des inserts distincts des parallèles :
  Emergent → design futuriste → "Emergent" ou "Emergent Silver Prizm"
  Fearless → "Fearless"
  Get Hyped! → "Get Hyped!"
  Sensational Swatches → relic → patch=true
  Signatures → auto=true
  Prizm Dominance → "Prizm Dominance"
  Color Blast → fond multicolore éclaté → "Color Blast"
  Far & Away → "Far & Away"

PANINI SELECT:
Base (Concourse/Premier/Courtside tier) → ""
Silver → "Silver Select"
Blue/White → "Blue & White Select"
Gold /10 → "Gold Select"
Black /1 → "Black Select"
Tie-Dye → "Tie-Dye"
Light Blue Disco → "Light Blue Disco"

PANINI NATIONAL TREASURES / IMMACULATE:
Ces sets sont souvent numérotés et ont des relics/autos.
Variation = couleur du fond ou bordure visible (Gold, Silver, Black, Platinum, etc.)

TOPPS CHROME (MLB/NFL):
Base → ""
Refractor → "Refractor"
Blue Refractor → "Blue Refractor"
Orange Refractor → "Orange Refractor"
Red Refractor /5 → "Red Refractor"
Gold Refractor /50 → "Gold Refractor"
SuperFractor /1 → "SuperFractor"
Prism Refractor → "Prism Refractor"
Atomic Refractor → "Atomic Refractor"
Negative Refractor → "Negative Refractor"
X-Fractor → "X-Fractor"

TOPPS HERITAGE / BASE:
Base → ""
Short Print → "Short Print"
High Number → "High Number"
Chrome → "Chrome"
Black → "Black"
Blue → "Blue"
Red → "Red"
Gold /50 → "Gold"

UPPER DECK (NHL/NBA):
Young Guns → rc=true, variation="Young Guns"
Canvas → "Canvas"
French → "French"
Clear Cut → "Clear Cut"
Exclusives /100 → "Exclusives"

POKÉMON:
Holo Rare → "Holo Rare"
Reverse Holo → "Reverse Holo"
Full Art → "Full Art"
Secret Rare → "Secret Rare"
Rainbow Rare → "Rainbow Rare"
Gold → "Gold"
VMAX → note dans variation
V → note dans variation
ex → note dans variation

═══ RÈGLES GÉNÉRALES ═══

IDENTIFICATION DE LA VARIATION — ORDRE DE PRIORITÉ :
1. INSERTS D'ABORD : Est-ce que le design général de la carte (fond, cadre, composition) est DIFFÉRENT du style de base du set ? Si oui → c'est un INSERT, identifie son nom (Bang!, Jam!, Stained Glass, Color Blast, Emergent, etc.)
2. Cherche une indication TEXTUELLE sur la carte (nom de l'insert/parallèle imprimé)
3. Observe la BORDURE : argentée/holographique = Silver/Refractor, dorée = Gold, colorée unie = noter la couleur
4. Observe la TEXTURE : prismatique = Prizm/Holo, craquelée = Cracked Ice, rayures = Velocity
5. Combine INSERT + PARALLÈLE si applicable : "Bang! Silver Prizm", "Stained Glass Gold"
6. Regarde le numéro de tirage (/25 = souvent Gold ou Red, /10 = Gold, /1 = Black ou SuperFractor)
7. Si design standard du set sans effet spécial ni couleur différente → variation = ""

ERREUR FRÉQUENTE À ÉVITER : Une carte Mosaic avec une bordure bleue mais un design d'insert distinct (ex: Bang!, Jam!) N'EST PAS "Blue Mosaic" — c'est l'INSERT en question.

COLLECTION (set) :
- Lis le texte en bas ou en haut de la carte
- Sur les slabs PSA/BGS, le set est souvent indiqué sur l'étiquette
- Panini indique souvent le set sur le bas de la carte
- Topps indique le set logo en haut

RÈGLES BOOLÉENNES :
- rc = true si tu vois "Rookie Card", "RC", logo rookie officiel (étoile jaune), ou "Young Guns" (Upper Deck)
- auto = true si signature manuscrite visible OU "Autograph" OU "Auto" inscrit sur la carte
- patch = true si morceau de tissu/jersey encapsulé visible OU "Patch" OU "Relic" inscrit
- grade = "Raw" par défaut. Si slab PSA visible → "PSA X", BGS → "BGS X.X", CGC → "CGC X"
- num : UNIQUEMENT si tu lis "X/Y" ou "/Y" imprimé sur la carte comme tirage limité. Pas le numéro de carte (#123), pas le numéro de maillot.

Si une info est absente ou vraiment illisible → chaîne vide "".
Ne devine pas. Reste factuel à ce qui est visible.

IMPORTANT — SI DEUX IMAGES SONT FOURNIES (RECTO + VERSO) :
- La première image est le RECTO (face avant)
- La deuxième image est le VERSO (face arrière)
- Le verso contient souvent : nom exact du set, nom de l'insert en grand, numérotation, infos RC/Auto
- Le verso FAIT AUTORITÉ sur le recto pour : collection, variation, num, rc, auto, patch
- Si le verso indique "BANG!" en gros → variation contient "Bang!" (+ parallèle si visible au recto)
- Si le verso dit "PRIZM" → le parallèle du recto est probablement Silver Prizm ou similaire
- Croiser les deux faces pour avoir l'information la plus complète et précise possible.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  try {
    const { imageBase64, imageBase64Verso, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })

    const imageParts: object[] = [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ]
    if (imageBase64Verso) {
      imageParts.push({ inline_data: { mime_type: mimeType, data: imageBase64Verso } })
    }

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            ...imageParts,
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Gemini error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: any) => p.text ?? '').join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })

    const card = JSON.parse(match[0])
    return NextResponse.json(card)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
