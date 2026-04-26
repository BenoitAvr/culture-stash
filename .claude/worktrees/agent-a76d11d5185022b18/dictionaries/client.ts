import fr from './fr.json'
import en from './en.json'

export type Dict = typeof fr

const dicts = { fr, en } as const

export function getDict(lang: string): Dict {
  return lang === 'en' ? en : fr
}
