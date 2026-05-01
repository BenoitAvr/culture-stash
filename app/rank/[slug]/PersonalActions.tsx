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
    importTitle: string
    importHelp: string
    importFormatHint: string
    importPlaceholder: string
    importSubmit: string
    importCancel: string
  }
}) {
  const data = use(personalDataPromise)
  const router = useRouter()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

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

  function openImport() {
    setImportText('')
    setImportError(null)
    setImportOpen(true)
  }

  function closeImport() {
    setImportOpen(false)
    setImportError(null)
  }

  function submitImport() {
    if (!importText.trim()) {
      setImportError(labels.importInvalid)
      return
    }
    startTransition(async () => {
      const result = await importMarkdownList(topicSlug, importText)
      if (!result.ok) {
        setImportError(labels.importInvalid)
        return
      }
      const isFr = lang === 'fr'
      const ok = isFr ? `${result.imported} importés` : `${result.imported} imported`
      const miss = isFr ? `${result.unmatched.length} non trouvés` : `${result.unmatched.length} not matched`
      setImportOpen(false)
      setImportError(null)
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
            <button onClick={openImport} style={linkStyle}>{labels.import}</button>
          </>
        )}
      </div>

      {importOpen && (
        <div
          onClick={closeImport}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, width: '100%', maxWidth: 520,
              display: 'flex', flexDirection: 'column', gap: 12,
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: 0 }}>
              {labels.importTitle}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0 }}>
              {labels.importHelp}
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-5)', lineHeight: 1.5, margin: 0 }}>
              {labels.importFormatHint}
            </p>
            <textarea
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(null) }}
              placeholder={labels.importPlaceholder}
              rows={10}
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace', fontSize: 12,
                background: 'var(--bg-input)', color: 'var(--fg)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', resize: 'vertical', outline: 'none',
              }}
            />
            {importError && (
              <span style={{ fontSize: 12, color: 'var(--danger, #e05555)' }}>{importError}</span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={closeImport}
                disabled={isPending}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'none', color: 'var(--fg-3)',
                  border: '1px solid var(--border)',
                  fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {labels.importCancel}
              </button>
              <button
                onClick={submitImport}
                disabled={isPending}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'var(--btn)', color: 'var(--btn-text)',
                  border: 'none',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? '…' : labels.importSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
