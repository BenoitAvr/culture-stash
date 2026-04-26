'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { saveUserTopicNote } from '@/app/actions/topicNotes'

export function PersonalTopicNote({
  topicSlug,
  initialContent,
  forceEdit,
  onEditStarted,
}: {
  topicSlug: string
  initialContent: string | null
  forceEdit?: boolean
  onEditStarted?: () => void
}) {
  const [content, setContent] = useState(initialContent ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (forceEdit && !editing) {
      setDraft(content)
      setEditing(true)
      onEditStarted?.()
    }
  }, [forceEdit])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      autoResize(textareaRef.current)
    }
  }, [editing])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveUserTopicNote(topicSlug, draft)
      if (!result?.error) {
        setContent(draft.trim())
        setEditing(false)
      }
    })
  }

  function handleCancel() {
    setDraft(content)
    setEditing(false)
  }

  function handleDelete() {
    startTransition(async () => {
      await saveUserTopicNote(topicSlug, '')
      setContent('')
      setEditing(false)
    })
  }

  if (!editing && !content) return null

  if (editing) {
    return (
      <div style={{ borderBottom: '1px solid var(--bg-input)', padding: '14px 0' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); autoResize(e.target) }}
          placeholder="Ta note personnelle, Markdown supporté…"
          rows={5}
          style={{
            width: '100%',
            background: 'var(--bg-deep)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--fg)',
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.7,
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleDelete}
            style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            Supprimer
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCancel}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-7)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid var(--bg-input)', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          onClick={() => { setDraft(content); setEditing(true) }}
          style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: 'color .15s' }}
        >
          Modifier
        </button>
      </div>
      <div style={{ color: 'var(--fg-3)', fontSize: 13, lineHeight: 1.75 }} className="prose-note">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
