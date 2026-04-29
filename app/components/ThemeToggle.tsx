'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const t = (localStorage.getItem('theme') || 'light') as 'light' | 'dark'
    setTheme(t)
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button onClick={toggle} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--fg-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
