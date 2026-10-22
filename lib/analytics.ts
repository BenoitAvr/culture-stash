// Client-side analytics helper. Wraps @vercel/analytics' track() with
// typed event names and SSR safety: calling trackEvent from a server
// path is a no-op (track() exists only in the browser).
//
// Keep the event vocabulary and property shapes defined here so dashboards
// stay stable — Vercel Analytics indexes events by exact name.
import { track } from '@vercel/analytics'

type RankSaveMode = 'guest' | 'logged_in'
type AuthProvider = 'password' | 'google'

export type AnalyticsEvent =
  // A tier list save landed (full editor or quick-add). Fire ONLY after the
  // server (or localStorage for a pure-guest fallback) has acknowledged.
  | { name: 'rank_save'; props: { mode: RankSaveMode; topic: string; items: number; source: 'editor' | 'quick_add' | 'remove' } }
  // Guest's anonymous data got merged onto their fresh account at login.
  | { name: 'guest_claim_completed'; props: { strategy: 'keep' | 'merge' | 'replace' | 'simple'; applied: number; kept: number } }
  // Fired when the signup form is submitted — the server action redirects
  // on success, so count signup_submitted as our "intent to create account".
  | { name: 'signup_submitted'; props: { provider: AuthProvider; from_guest: boolean } }
  | { name: 'login_submitted'; props: { provider: AuthProvider; from_guest: boolean } }

// SSR-safe no-op if called before hydration; properties are kept flat
// (strings/numbers/booleans) because Vercel's track rejects nested objects.
export function trackEvent(ev: AnalyticsEvent) {
  if (typeof window === 'undefined') return
  try {
    track(ev.name, ev.props as Record<string, string | number | boolean>)
  } catch {
    // Analytics must never break a save or an auth flow.
  }
}
