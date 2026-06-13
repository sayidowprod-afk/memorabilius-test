import Link from 'next/link'
import { headers } from 'next/headers'

export default async function Confirm() {
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') || ''
  const lang = acceptLang.toLowerCase().startsWith('en') ? 'en' : 'fr'

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>📬</div>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>
        {lang === 'fr' ? 'Vérifiez vos emails !' : 'Check your emails!'}
      </h1>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        {lang === 'fr'
          ? 'Un lien de confirmation vous a été envoyé. Cliquez dessus pour activer votre compte.'
          : 'A confirmation link has been sent. Click it to activate your account.'}
      </p>
      <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 12, padding: 16, marginBottom: 32, fontSize: 14, color: '#7a6000' }}>
        💡 {lang === 'fr' ? 'Vérifiez aussi vos spams.' : 'Also check your spam folder.'}
      </div>
      <Link href="/connexion" className="btn-main btn-primary">
        {lang === 'fr' ? 'Se connecter' : 'Sign in'}
      </Link>
    </div>
  )
}
