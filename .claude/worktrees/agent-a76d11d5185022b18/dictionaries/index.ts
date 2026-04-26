import 'server-only'
import fr from './fr.json'
import en from './en.json'

const dicts = { fr, en }

export type Lang = keyof typeof dicts
export type Dict = typeof fr

export const LOCALES: Lang[] = ['fr', 'en']
export const DEFAULT_LOCALE: Lang = 'fr'

export const hasLocale = (l: string): l is Lang => l in dicts

export const getDictionary = (lang: Lang): Dict => dicts[lang]
