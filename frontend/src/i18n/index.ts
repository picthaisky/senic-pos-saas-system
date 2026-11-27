import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import th from './locales/th.json'

export const LANGUAGES = ['th', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'senic.lang'

// th.json is the source of truth for keys; `t('...')` is type-checked against it.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof th }
  }
}

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'th'
}

i18n.on('languageChanged', (language) => {
  localStorage.setItem(STORAGE_KEY, language)
  document.documentElement.lang = language
})

void i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'th',
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
