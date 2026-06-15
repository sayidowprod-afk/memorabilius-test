'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Lang = 'fr' | 'en'

const translations = {
  fr: {
    // Navbar
    nav_annuaire: 'Annuaire',
    nav_teams: 'Teams',
    nav_trades: 'Trades',
    nav_recherche: '🔍 Recherche',
    nav_tuto: 'Tutoriel',
    nav_galerie: 'Ma galerie',
    nav_messages: 'Messages',
    nav_profil: 'Profil',
    nav_connexion: 'Connexion',
    nav_inscription: "S'inscrire",
    nav_deconnexion: 'Déconnexion',
    nav_mode_clair: '☀️ Mode clair',
    nav_mode_sombre: '🌙 Mode sombre',

    // Accueil
    home_hero: 'Exposez votre passion en 3D.',
    home_sub: 'La plateforme ultime pour les collectionneurs de cartes de Sports.',
    home_cta1: 'Créer ma galerie',
    home_cta2: "Voir l'annuaire",
    home_collectors: 'Collectionneurs',
    home_cards: 'Cartes répertoriées',
    home_3d: '100% Interactif & 3D',
    home_pepites: '✨ Dernières pépites',

    // Galerie
    gallery_search: 'Joueur, variation...',
    gallery_team: 'Équipe',
    gallery_all: 'Toutes',
    gallery_collection: 'Collection',
    gallery_year: 'Année',
    gallery_privacy: 'Gérer les cartes',
    gallery_done: '✓ Terminer',
    gallery_message: '💬 Envoyer un message',
    gallery_share: '🔗 Partager',
    gallery_private: '🔒 PRIVÉ',
    gallery_make_private: '🔒 Rendre privé',
    gallery_make_public: '🔓 Rendre public',
    gallery_total: 'carte(s) au total',

    // Trades
    trades_title: 'Trades',
    trades_post: '+ Poster une annonce',
    trades_search: 'Rechercher un joueur, une carte...',
    trades_all: 'Tous',
    trades_offers: '📤 Offres',
    trades_searches: '📥 Recherches',
    trades_sport: 'Sport :',
    trades_tags: 'Tags :',
    trades_by: 'Proposé par',
    trades_mark_done: '✓ Marquer comme conclu',
    trades_edit: '✏️ Modifier l\'annonce',
    trades_delete: '🗑️ Supprimer l\'annonce',
    trades_published: 'Publié le',

    // Annuaire
    directory_title: 'Annuaire des collectionneurs',
    directory_collector: 'Collectionneur',
    directory_total: 'Total',

    // Teams
    teams_title: 'Annuaire des Teams',
    teams_create: 'Créer ma Team',
    teams_search: 'Rechercher une team...',
    teams_members: 'Membres',
    teams_total_cards: 'Total cartes',
    teams_action: 'Action',
    teams_join: 'Rejoindre',
    teams_pending: '⏳ En attente',
    teams_my_team: 'Ma Team ✓',
    teams_chat: '💬 Chat',
    teams_candidatures: '📋 Candidatures',
    teams_no_message: 'Aucun message — soyez le premier à écrire !',
    teams_send: 'Envoyer',
    teams_accept: '✓ Accepter',
    teams_refuse: '✗ Refuser',
    teams_promote: '↑ Promouvoir',
    teams_demote: '↓ Rétrograder',
    teams_kick: '🚫 Kick',
    teams_leave: 'Quitter la team',
    teams_modify: '✏️ Modifier',
    teams_no_candidatures: 'Aucune candidature en attente',

    // Profil
    profile_title: 'Mon profil',
    profile_save: 'Sauvegarder',
    profile_saved: '✓ Sauvegardé !',
    profile_pseudo: 'Pseudo',
    profile_csv: 'Lien CSV Google Sheets',
    profile_logo: 'URL de votre logo',
    profile_border: 'Couleur des bordures',
    profile_danger: '⚠️ Zone de danger',
    profile_delete: 'Supprimer mon compte',
    profile_delete_confirm: 'Tapez SUPPRIMER pour confirmer :',
    profile_delete_btn: 'Supprimer définitivement',
    profile_cancel: 'Annuler',
    profile_photo: 'Photo de profil',
    profile_change_photo: '📷 Changer ma photo',

    // Messages
    messages_title: 'Messages',
    messages_none: 'Aucune conversation',
    messages_select: 'Sélectionnez une conversation',
    messages_placeholder: 'Votre message...',
    messages_send: 'Envoyer',

    // Notifications
    notif_title: '🔔 Notifications',
    notif_none: 'Aucune notification pour l\'instant',

    // Auth
    login_title: 'Connexion',
    login_email: 'Email',
    login_password: 'Mot de passe',
    login_btn: 'Se connecter',
    login_no_account: 'Pas encore de compte ?',
    login_forgot: 'Mot de passe oublié ?',
    register_title: 'Créer un compte',
    register_sub: 'Rejoignez la communauté des collectionneurs',
    register_pseudo: 'Pseudo',
    register_btn: 'Créer mon compte',
    register_have_account: 'Déjà un compte ?',
    register_connect: 'Se connecter',

    // 404
    not_found_title: 'Cette carte n\'existe pas',
    not_found_sub: 'La page que vous cherchez n\'existe pas ou a été déplacée.',
    not_found_home: 'Retour à l\'accueil',
    not_found_directory: 'Voir l\'annuaire',

    // Extras
    gallery_cards: 'Cartes',
    gallery_search_label: 'Recherche',
    gallery_team_label: 'Équipe',
    gallery_collection_label: 'Collection',
    gallery_year_label: 'Année',
    by_label: 'par',
    all_teams: 'Toutes les teams',
    teams_role: 'Rôle',
    teams_cards: 'Cartes',
    teams_collector: 'Collectionneur',
    teams_total_cards_label: 'Total cartes',
    teams_see_my_team: 'Voir ma team →',
    profile_csv_label: 'Lien CSV Google Sheets',
    profile_logo_label: 'URL de votre logo (galerie)',
    profile_delete_warning: 'La suppression de votre compte est irréversible. Toutes vos données seront perdues.',
    pwa_install: 'Installer Memorabilius',
    pwa_sub: 'Accès rapide depuis votre écran d\'accueil',
    pwa_later: 'Plus tard',
    pwa_install_btn: 'Installer',
    search_title: '🔍 Recherche globale',
    search_sub: 'Cherchez une carte dans toutes les collections de la communauté',
    search_placeholder: 'Nom du joueur, équipe, variation...',
    search_min_chars: 'Tapez au moins 2 caractères',
    search_results: 'carte(s) trouvée(s) pour',
    search_none: 'Aucune carte trouvée pour',
    search_none_sub: 'Essayez avec un nom différent ou vérifiez l\'orthographe',
    tuto_video: '🎬 Tutoriel Vidéo',
    tuto_title: 'Comment créer votre galerie',
    tuto_sub: 'Suivez ces 4 étapes simples pour lier votre collection Google Sheets à Memorabilius.',
  },
  en: {
    // Navbar
    nav_annuaire: 'Directory',
    nav_teams: 'Teams',
    nav_trades: 'Trades',
    nav_recherche: '🔍 Search',
    nav_tuto: 'Tutorial',
    nav_galerie: 'My gallery',
    nav_messages: 'Messages',
    nav_profil: 'Profile',
    nav_connexion: 'Login',
    nav_inscription: 'Sign up',
    nav_deconnexion: 'Logout',
    nav_mode_clair: '☀️ Light mode',
    nav_mode_sombre: '🌙 Dark mode',

    // Home
    home_hero: 'Showcase your passion in 3D.',
    home_sub: 'The ultimate platform for sports card collectors.',
    home_cta1: 'Create my gallery',
    home_cta2: 'View directory',
    home_collectors: 'Collectors',
    home_cards: 'Cards listed',
    home_3d: '100% Interactive & 3D',
    home_pepites: '✨ Latest gems',

    // Gallery
    gallery_search: 'Player, variation...',
    gallery_team: 'Team',
    gallery_all: 'All',
    gallery_collection: 'Collection',
    gallery_year: 'Year',
    gallery_privacy: 'Manage cards',
    gallery_done: '✓ Done',
    gallery_message: '💬 Send a message',
    gallery_share: '🔗 Share',
    gallery_private: '🔒 PRIVATE',
    gallery_make_private: '🔒 Make private',
    gallery_make_public: '🔓 Make public',
    gallery_total: 'card(s) total',

    // Trades
    trades_title: 'Trades',
    trades_post: '+ Post an ad',
    trades_search: 'Search a player, card...',
    trades_all: 'All',
    trades_offers: '📤 Offers',
    trades_searches: '📥 Searches',
    trades_sport: 'Sport:',
    trades_tags: 'Tags:',
    trades_by: 'Posted by',
    trades_mark_done: '✓ Mark as completed',
    trades_edit: '✏️ Edit ad',
    trades_delete: '🗑️ Delete ad',
    trades_published: 'Published on',

    // Directory
    directory_title: 'Collectors directory',
    directory_collector: 'Collector',
    directory_total: 'Total',

    // Teams
    teams_title: 'Teams directory',
    teams_create: 'Create my Team',
    teams_search: 'Search a team...',
    teams_members: 'Members',
    teams_total_cards: 'Total cards',
    teams_action: 'Action',
    teams_join: 'Join',
    teams_pending: '⏳ Pending',
    teams_my_team: 'My Team ✓',
    teams_chat: '💬 Chat',
    teams_candidatures: '📋 Applications',
    teams_no_message: 'No messages yet — be the first to write!',
    teams_send: 'Send',
    teams_accept: '✓ Accept',
    teams_refuse: '✗ Decline',
    teams_promote: '↑ Promote',
    teams_demote: '↓ Demote',
    teams_kick: '🚫 Kick',
    teams_leave: 'Leave team',
    teams_modify: '✏️ Edit',
    teams_no_candidatures: 'No pending applications',

    // Profile
    profile_title: 'My profile',
    profile_save: 'Save',
    profile_saved: '✓ Saved!',
    profile_pseudo: 'Username',
    profile_csv: 'Google Sheets CSV link',
    profile_logo: 'Your logo URL',
    profile_border: 'Border color',
    profile_danger: '⚠️ Danger zone',
    profile_delete: 'Delete my account',
    profile_delete_confirm: 'Type DELETE to confirm:',
    profile_delete_btn: 'Delete permanently',
    profile_cancel: 'Cancel',
    profile_photo: 'Profile picture',
    profile_change_photo: '📷 Change my photo',

    // Messages
    messages_title: 'Messages',
    messages_none: 'No conversations',
    messages_select: 'Select a conversation',
    messages_placeholder: 'Your message...',
    messages_send: 'Send',

    // Notifications
    notif_title: '🔔 Notifications',
    notif_none: 'No notifications yet',

    // Auth
    login_title: 'Login',
    login_email: 'Email',
    login_password: 'Password',
    login_btn: 'Sign in',
    login_no_account: 'No account yet?',
    login_forgot: 'Forgot password?',
    register_title: 'Create an account',
    register_sub: 'Join the collectors community',
    register_pseudo: 'Username',
    register_btn: 'Create my account',
    register_have_account: 'Already have an account?',
    register_connect: 'Sign in',

    // 404
    not_found_title: 'This card does not exist',
    not_found_sub: 'The page you are looking for does not exist or has been moved.',
    not_found_home: 'Back to home',
    not_found_directory: 'View directory',

    // Extras
    gallery_cards: 'Cards',
    gallery_search_label: 'Search',
    gallery_team_label: 'Team',
    gallery_collection_label: 'Collection',
    gallery_year_label: 'Year',
    by_label: 'by',
    all_teams: 'All teams',
    teams_role: 'Role',
    teams_cards: 'Cards',
    teams_collector: 'Collector',
    teams_total_cards_label: 'Total cards',
    teams_see_my_team: 'View my team →',
    profile_csv_label: 'Google Sheets CSV link',
    profile_logo_label: 'Your logo URL (gallery)',
    profile_delete_warning: 'Account deletion is irreversible. All your data will be lost.',
    pwa_install: 'Install Memorabilius',
    pwa_sub: 'Quick access from your home screen',
    pwa_later: 'Later',
    pwa_install_btn: 'Install',
    search_title: '🔍 Global search',
    search_sub: 'Search for a card across all community collections',
    search_placeholder: 'Player name, team, variant...',
    search_min_chars: 'Type at least 2 characters',
    search_results: 'card(s) found for',
    search_none: 'No cards found for',
    search_none_sub: 'Try a different name or check the spelling',
    tuto_video: '🎬 Video Tutorial',
    tuto_title: 'How to create your gallery',
    tuto_sub: 'Follow these 4 simple steps to link your Google Sheets collection to Memorabilius.',
  }
}

type TranslationKey = keyof typeof translations.fr

const LangContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}>({ lang: 'fr', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang
    if (saved === 'fr' || saved === 'en') setLangState(saved)
    else {
      // Détecter la langue du navigateur
      const browser = navigator.language.startsWith('en') ? 'en' : 'fr'
      setLangState(browser)
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  const t = (key: TranslationKey): string => translations[lang][key] || translations.fr[key] || key

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
