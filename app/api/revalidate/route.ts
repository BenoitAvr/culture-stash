import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET
  const got = req.headers.get('x-revalidate-secret')
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tag = req.nextUrl.searchParams.get('tag')
  if (!tag) {
    return NextResponse.json({ error: 'missing tag' }, { status: 400 })
  }
  revalidateTag(tag, 'max')
  return NextResponse.json({ revalidated: tag, now: Date.now() })
}
