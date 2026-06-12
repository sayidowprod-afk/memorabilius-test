'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const { t } = useLang()

  useEffect(() => {
    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    // Capturer l'événement d'installation
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#003DA6', color: 'white', borderRadius: 16,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 8px 30px rgba(0,61,166,0.4)', zIndex: 9999,
      maxWidth: 360, width: 'calc(100% - 40px)',
    }}>
      <span style={{ fontSize: 28 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{t('pwa_install')}</p>
        <p style={{ fontSize: 12, margin: '2px 0 0', opacity: 0.8 }}>{t('pwa_sub')}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShow(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: 13 }}>
          Plus tard
        </button>
        <button onClick={install} style={{ background: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#003DA6', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
          Installer
        </button>
      </div>
    </div>
  )
}
