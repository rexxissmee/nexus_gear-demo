import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'

// Protected routes that require authentication
const PROTECTED_PREFIXES = [
    '/profile',
    '/checkout',
    '/cart',
    '/admin',
    '/api/cart',
    '/api/update-profile',
    '/api/users',
    '/api/admin',
    '/api/security/sessions',
    '/api/security/score',
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
    if (!isProtected) return NextResponse.next()

    const token = request.cookies.get('session_token')?.value

    if (!token) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const loginUrl = new URL('/auth', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    const payload = await verifyToken(token)
    if (!payload) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }
        const loginUrl = new URL('/auth', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        const response = NextResponse.redirect(loginUrl)
        response.cookies.delete('session_token')
        response.cookies.delete('session_id')
        return response
    }

    // Admin guard
    if (pathname.startsWith('/admin') && payload.role !== 'admin') {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/', request.url))
    }

    // Inject session info into request headers for downstream Node.js route handlers
    // (Event logging is done in API routes, NOT here – Edge Runtime cannot use Prisma/pg)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-session-id', payload.sessionId)
    requestHeaders.set('x-user-id', String(payload.userId))
    requestHeaders.set('x-user-role', payload.role)

    return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|public/).*)',
    ],
}
