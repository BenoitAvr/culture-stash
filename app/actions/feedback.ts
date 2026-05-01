'use server'

import { headers } from 'next/headers'
import { getSession } from '@/lib/session'

export type FeedbackResult = { ok: true } | { ok: false; error: 'empty' | 'too-long' | 'not-configured' | 'webhook-failed' }

export async function submitFeedback(input: { message: string; contact?: string }): Promise<FeedbackResult> {
  const message = input.message.trim()
  if (!message) return { ok: false, error: 'empty' }
  if (message.length > 2000) return { ok: false, error: 'too-long' }

  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (!webhook) return { ok: false, error: 'not-configured' }

  const session = await getSession()
  const h = await headers()
  const referer = h.get('referer') ?? 'unknown'
  const ua = h.get('user-agent') ?? 'unknown'

  const author = session
    ? `${session.name} <${session.email}>`
    : input.contact?.trim() || 'anonymous'

  const body = {
    embeds: [
      {
        title: '💬 Feedback',
        description: message,
        color: 0x7c6df0,
        fields: [
          { name: 'From', value: author, inline: false },
          { name: 'Page', value: referer.slice(0, 1000), inline: false },
          { name: 'User-Agent', value: ua.slice(0, 500), inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('[feedback] discord webhook returned', res.status, await res.text())
      return { ok: false, error: 'webhook-failed' }
    }
    return { ok: true }
  } catch (e) {
    console.error('[feedback] discord webhook error', e)
    return { ok: false, error: 'webhook-failed' }
  }
}
