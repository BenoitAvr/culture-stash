'use client'

import { use, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { importMarkdownList } from '@/app/actions/entryLists'
import { pickTitle } from '@/lib/i18n'
import type { PersonalRankData } from './RankTopicPage'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}

export function PersonalActions({
  topicSlug,
  topicTitle,
  topicEmoji,
  lang,
  personalDataPromise,
  labels,
}: {
  topicSlug: string
  topicTitle: string
  topicEmoji: string
  lang: string
  personalDataPromise: Promise<PersonalRankData>
  labels: {
    create: string
    edit: string
    login: string
    share: string
    copyList: string
    import: string
    shareCopied: string
    listCopied: string
    importInvalid: string
  }
}) {
  const data = use(personalDataPromise)
  const router = useRouter()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const myList = data.userLists.find(
    l => l.userId === data.currentUserId && (l.type === 'TIER' || l.type === 'BOTH')
  ) ?? null

  if (!data.isLoggedIn) {
    return (
      <Link
        href={`/${lang}/auth/login`}
        style={{
          padding: '10px 22px', borderRadius: 8,
          background: 'var(--bg-card)', color: 'var(--fg)',
          border: '1px solid var(--border)',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}
      >
        {labels.login}
      </Link>
    )
  }

  function handleShare() {
    if (!myList) return
    const url = `${window.location.origin}/${lang}/rank/${topicSlug}/${encodeURIComponent(myList.username)}`
    navigator.clipboard.writeText(url).then(() => {
      setFeedback(labels.shareCopied)
      setTimeout(() => setFeedback(null), 2000)
    })
  }

  function handleCopyMarkdown() {
    if (!myList) return
    const rankedTiers = (myList.rankedTiers ?? '').split(',').filter(Boolean)
    const lines: string[] = [`# ${topicEmoji} ${topicTitle}`, '']

    for (const tier of TIERS) {
      const items = myList.items
        .filter(i => i.tier === tier)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      if (items.length === 0) continue

      lines.push(`## ${TIER_LABEL[tier]}`)
      const isRanked = rankedTiers.includes(tier)
      items.forEach((item, idx) => {
        const title = pickTitle(item.entry, lang)
        const year = item.entry.year ? ` (${item.entry.year})` : ''
        const note = item.note ? ` — ${item.note}` : ''
        const prefix = isRanked ? `${idx + 1}.` : '-'
        lines.push(`${prefix} ${title}${year}${note}`)
      })
      lines.push('')
    }

    navigator.clipboard.writeText(lines.join('\n').trimEnd() + '\n').then(() => {
      setFeedback(labels.listCopied)
      setTimeout(() => setFeedback(null), 2000)
    })
  }

  async function handleImport() {
    let markdown: string
    try {
      markdown = await navigator.clipboard.readText()
    } catch {
      setFeedback(labels.importInvalid)
      setTimeout(() => setFeedback(null), 3000)
      return
    }
    if (!markdown.trim()) {
      setFeedback(labels.importInvalid)
      setTimeout(() => setFeedback(null), 3000)
      return
    }
    startTransition(async () => {
      const result = await importMarkdownList(topicSlug, markdown)
      if (!result.ok) {
        setFeedback(labels.importInvalid)
        setTimeout(() => setFeedback(null), 3000)
        return
      }
      const isFr = lang === 'fr'
      const ok = isFr ? `${result.imported} importés` : `${result.imported} imported`
      const miss = isFr ? `${result.unmatched.length} non trouvés` : `${result.unmatched.length} not matched`
      setFeedback(result.unmatched.length > 0 ? `${ok} · ${miss}` : ok)
      setTimeout(() => setFeedback(null), 3000)
      router.refresh()
    })
  }

  const linkStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-5)',
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <Link
        href={`/${lang}/rank/${topicSlug}/edit`}
        style={{
          padding: '10px 22px', borderRadius: 8,
          background: 'var(--bg-card)', color: 'var(--fg)',
          border: '1px solid var(--border)',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}
      >
        {myList ? labels.edit : labels.create}
      </Link>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 16 }}>
        {feedback ? (
          <span style={{ fontSize: 11, color: 'var(--accent-fg)' }}>{feedback}</span>
        ) : (
          <>
            {myList && <button onClick={handleShare} style={linkStyle}>{labels.share}</button>}
            {myList && <button onClick={handleCopyMarkdown} style={linkStyle}>{labels.copyList}</button>}
            <button onClick={handleImport} disabled={isPending} style={linkStyle}>
              {isPending ? '…' : labels.import}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
