import { ImageResponse } from 'next/og'
import { IconArt } from '@/lib/iconArt'

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = (await params).size === '512' ? 512 : 192
  return new ImageResponse(<IconArt size={n} />, {
    width: n,
    height: n,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  })
}
