'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

export function NavSearch({ lang, placeholder }: { lang: string; placeholder: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = ref.current?.value.trim()
    if (q) router.push(`/${lang}/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#1e1e1e', border: '1px solid #2a2a2a',
      borderRadius: 8, padding: '8px 14px', width: 260,
    }}>
      <svg width="14" height="14" fill="none" stroke="#777" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        defaultValue={searchParams.get('q') ?? ''}
        style={{ background: 'none', border: 'none', outline: 'none', color: '#f0f0f0', fontFamily: 'inherit', fontSize: 13, width: '100%' }}
      />
    </form>
  )
}
