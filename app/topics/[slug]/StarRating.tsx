'use client'

import { useState, useTransition } from 'react'
import { setRating } from '@/app/actions/ratings'
import type { Dict } from '@/dictionaries/client'

export function StarRating({
  resourceId, topicSlug, initialUserRating, initialAvg, initialCount, isLoggedIn, t,
}: {
  resourceId: string
  topicSlug: string
  initialUserRating: number | null
  initialAvg: number
  initialCount: number
  isLoggedIn: boolean
  t: Dict['starRating']
}) {
  const [userRating, setUserRating] = useState(initialUserRating)
  const [avg, setAvg] = useState(initialAvg)
  const [count, setCount] = useState(initialCount)
  const [hover, setHover] = useState(0)
  const [isPending, startTransition] = useTransition()

  function handleRate(stars: number) {
    if (!isLoggedIn) return
    startTransition(async () => {
      const next = userRating === stars ? null : stars
      if (next === null) {
        const newCount = Math.max(0, count - 1)
        setAvg(newCount === 0 ? 0 : (avg * count - userRating!) / newCount)
        setCount(newCount)
      } else if (userRating !== null) {
        setAvg((avg * count - userRating + next) / count)
      } else {
        setAvg((avg * count + next) / (count + 1))
        setCount(c => c + 1)
      }
      setUserRating(next)
      await setRating(resourceId, topicSlug, next)
    })
  }

  const display = hover || userRating || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 80 }}>
      <div style={{ display: 'flex', gap: 2, opacity: isPending ? 0.6 : 1 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => handleRate(star)} onMouseEnter={() => isLoggedIn ? setHover(star) : undefined} disabled={isPending}
            title={isLoggedIn ? `${star} ${star > 1 ? t.stars : t.star}` : t.loginRequired}
            style={{ background: 'none', border: 'none', fontSize: 18, lineHeight: 1, padding: '0 1px', cursor: isLoggedIn ? 'pointer' : 'default', color: star <= display ? '#f5a623' : 'var(--fg-9)', transition: 'color .1s' }}
          >
            {star <= display ? '★' : '☆'}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>
        {count > 0 ? (
          <span>
            <span style={{ color: '#f5a623', fontWeight: 600 }}>{avg.toFixed(1)}</span>
            {' '}
            <span>({count} {t.reviews})</span>
          </span>
        ) : (
          <span>{t.notRated}</span>
        )}
      </div>
    </div>
  )
}
