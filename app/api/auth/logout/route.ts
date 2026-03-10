import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { revokeSession } from '@/lib/session'

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        const sessionId = request.cookies.get('session_id')?.value

        if (token && sessionId) {
            const payload = await verifyToken(token)
            if (payload) {
                await revokeSession(payload.sessionId, 'manual_logout')
            } else if (sessionId) {
                // Try to revoke by sessionId even if token expired
                await revokeSession(sessionId, 'manual_logout_expired_token')
            }
        }

        const response = NextResponse.json({ success: true, message: 'Logged out.' })
        response.cookies.delete('session_token')
        response.cookies.delete('session_id')

        return response
    } catch (error) {
        console.error('POST /api/auth/logout error:', error)
        // Always clear cookies even on error
        const response = NextResponse.json({ success: true, message: 'Logged out.' })
        response.cookies.delete('session_token')
        response.cookies.delete('session_id')
        return response
    }
}
