import { NextResponse, type NextRequest } from 'next/server'
import { authConfigured } from '@/lib/auth'
import { siteUrl, supaAuth } from '@/lib/supaAuth'

/** "Continue with Google": send them to Google, which comes back to /auth/confirm. */
export async function GET(req: NextRequest) {
  const home = siteUrl(req)
  if (!authConfigured()) return NextResponse.redirect(`${home}/?auth=unavailable`)
  const sb = await supaAuth()
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${home}/auth/confirm?next=google`, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  })
  if (error || !data.url) return NextResponse.redirect(`${home}/?auth=google-off`)
  return NextResponse.redirect(data.url)
}
