'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/app/actions/likes'

export function LikeButton({
  noteId, topicSlug, initialLikes, initialLiked,
}: {
  noteId: string
  topicSlug: string
  initialLikes: number
  initialLiked: boolean
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [liked, setLiked] = useState(initialLiked)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const next = !liked
      setLiked(next)
      setLikes(l => next ? l + 1 : l - 1)
      await toggleLike(noteId, topicSlug)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
        color: liked ? '#f5a623' : '#777', transition: 'color .15s', fontFamily: 'inherit',
        opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap',
      }}
    >
      {liked ? '♥' : '♡'} {likes}
    </button>
  )
}
