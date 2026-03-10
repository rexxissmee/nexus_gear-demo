import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { refreshSession } from '@/lib/session'

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'No session token' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip') || ''
        const ua = request.headers.get('user-agent') || ''

        const result = await refreshSession(payload.sessionId, token, ip, ua)
        if (!result) {
            return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 })
        }

        const response = NextResponse.json({
            success: true,
            message: 'Token refreshed.',
            sessionId: result.sessionId,
            expiresAt: result.expiresAt.toISOString(),
        })

        response.cookies.set('session_token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: result.expiresAt,
        })
        response.cookies.set('session_id', result.sessionId, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: result.expiresAt,
        })

        return response
    } catch (error) {
        console.error('POST /api/auth/refresh error:', error)
        return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
    }
}
