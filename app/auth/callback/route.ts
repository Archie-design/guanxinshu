import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const isLocalEnv = process.env.NODE_ENV === 'development'
            const forwardedHost = request.headers.get('x-forwarded-host')
            const host = request.headers.get('host')

            let protocol = 'https'
            if (isLocalEnv) {
                protocol = 'http'
            }

            // Priority: X-Forwarded-Host (Vercel) > Host (Local/LAN) > origin
            const domain = forwardedHost || host || 'localhost:3000'
            const baseUrl = `${protocol}://${domain}`

            return NextResponse.redirect(`${baseUrl}${next}`)
        }
    }

    // Return to error page on failure
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    return NextResponse.redirect(`${protocol}://${host}/auth/auth-code-error`)
}
