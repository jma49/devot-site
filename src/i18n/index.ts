import { en, type Messages } from './en.ts'

export const LOCALES = { en } satisfies Record<string, Messages>

export type Locale = keyof typeof LOCALES

export function messages(locale: Locale = 'en'): Messages {
  return LOCALES[locale]
}
