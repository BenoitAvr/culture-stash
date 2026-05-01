'use client'

import { use, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import type { PersonalRankData } from './RankTopicPage'

type ExportPayload = {
  version: 1
  topicSlug: string
  rankedTiers: string
  items: Array<{
    entryId: string
    title: string
    tier: string | null
    position: number | null
    note: string | null
  }>
}

export function PersonalActions({
  topicSlug,
  lang,
  personalDataPromise,
  labels,
}: {
  topicSlug: string
  lang: string
  personalDataPromise: Promise<PersonalRankData>
  labels: {
    create: string
    edit: string
    login: string
    share: string
    export: string
    import: string
    shareCopied: string
    importInvalid: string
    importConfirm: string
  }
}) {
  const data = use(personalDataPromise)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
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
          padding: '8px 18px', borderRadius: 8,
          background: 'transparent', color: 'var(--fg-2)',
          border: '1px solid var(--border)',
          fontSize: 13, fontWeight: 500, textDecoration: 'none',
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

  function handleExport() {
    if (!myList) return
    const payload: ExportPayload = {
      version: 1,
      topicSlug,
      rankedTiers: myList.rankedTiers ?? '',
      items: myList.items.map(i => ({
        entryId: i.entryId,
        title: i.entry.title,
        tier: i.tier,
        position: i.position,
        note: i.note,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${topicSlug}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const parsed = JSON.parse(text) as ExportPayload
        if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
          setFeedback(labels.importInvalid)
          setTimeout(() => setFeedback(null), 3000)
          return
        }
        const tierItems = parsed.items.map(i => ({
          entryId: i.entryId,
          tier: i.tier ?? undefined,
          position: i.position ?? undefined,
          note: i.note ?? undefined,
        }))
        const rankedTiers = parsed.rankedTiers ? parsed.rankedTiers.split(',').filter(Boolean) : []
        startTransition(async () => {
          await saveUserEntryLists(topicSlug, [], tierItems, rankedTiers)
          router.refresh()
        })
      } catch {
        setFeedback(labels.importInvalid)
        setTimeout(() => setFeedback(null), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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
          padding: '8px 18px', borderRadius: 8,
          background: 'transparent', color: 'var(--fg-2)',
          border: '1px solid var(--border)',
          fontSize: 13, fontWeight: 500, textDecoration: 'none',
        }}
      >
        {myList ? labels.edit : labels.create}
      </Link>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 16 }}>
        {feedback ? (
          <span style={{ fontSize: 11, color: 'var(--accent-fg)' }}>{feedback}</span>
        ) : myList ? (
          <>
            <button onClick={handleShare} style={linkStyle}>{labels.share}</button>
            <button onClick={handleExport} style={linkStyle}>{labels.export}</button>
          </>
        ) : (
          <button onClick={handleImportClick} disabled={isPending} style={linkStyle}>
            {isPending ? '…' : labels.import}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
    </div>
  )
}
