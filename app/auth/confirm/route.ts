import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { authConfigured, cookieOptions, getStore, startSession } from '@/lib/auth'
import { isApproved } from '@/lib/people'
import { NOTICE, siteUrl, supaAuth } from '@/lib/supaAuth'

/**
 * Where every link lands: "verify your email", "reset your password", and Google coming back.
 * Email links carry `token_hash` (works even if opened on a different phone than the one that
 * signed up); Google and Supabase's default links carry a one-time `code`.
 */
export async function GET(req: NextRequest) {
  const home = siteUrl(req)
  const p = req.nextUrl.searchParams
  if (!authConfigured()) return NextResponse.redirect(`${home}/?auth=unavailable`)
  const sb = await supaAuth()

  const tokenHash = p.get('token_hash')
  const type = p.get('type') as EmailOtpType | null
  const code = p.get('code')
  const reset = type === 'recovery' || p.get('next') === 'reset'

  const { data, error } = tokenHash && type ? await sb.auth.verifyOtp({ token_hash: tokenHash, type }) : code ? await sb.auth.exchangeCodeForSession(code) : { data: null, error: new Error('missing') }
  const email = data?.user?.email
  if (error || !email) return NextResponse.redirect(`${home}/?auth=expired`)

  // Reset: keep the short Supabase session so the next screen can save the new password.
  if (reset) return NextResponse.redirect(`${home}/?auth=reset`)

  await sb.auth.signOut({ scope: 'local' })
  if (!(await isApproved(getStore(), email))) {
    const res = NextResponse.redirect(`${home}/?auth=notapproved`)
    res.cookies.set(NOTICE, email, { ...cookieOptions(300), httpOnly: true })
    return res
  }
  return startSession(NextResponse.redirect(`${home}/`), email)
}
