import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session'
import { verifyToken } from '@/lib/jwt'

/**
 * GET /api/auth/check
 * Validates the current session against the DB.
 * Called periodically by the client to detect remote session revocation.
 * Returns 200 if valid, 401 if revoked/expired.
 */
export async function GET(request: NextRequest) {
    const token = request.cookies.get('session_token')?.value
    if (!token) {
        return NextResponse.json({ valid: false, reason: 'no_token' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
        return NextResponse.json({ valid: false, reason: 'invalid_token' }, { status: 401 })
    }

    // Check DB: is session still active (not revoked, not expired)?
    const isValid = await validateSession(payload, token)
    if (!isValid) {
        const response = NextResponse.json({ valid: false, reason: 'session_revoked' }, { status: 401 })
        // Clear stale cookies so client knows to redirect
        response.cookies.delete('session_token')
        response.cookies.delete('session_id')
        return response
    }

    return NextResponse.json({ valid: true, sessionId: payload.sessionId })
}
