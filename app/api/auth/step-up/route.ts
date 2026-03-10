import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/event-logger'
import { verifyToken } from '@/lib/jwt'
import bcrypt from 'bcryptjs'

/**
 * POST /api/auth/step-up
 * Re-authenticates the current session user by password.
 * Decodes userId + sessionId from JWT cookie (session_token).
 *
 * Body: { password: string }
 * Success: { success: true }
 * Fail:    { error: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Decode JWT from cookie to get userId + sessionId (same cookie used by /api/auth/check)
        const token = request.cookies.get('session_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const { userId, sessionId } = payload

        const body = await request.json()
        const { password } = body

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ error: 'Password required' }, { status: 400 })
        }

        // Fetch user from DB
        const user = await prisma.user.findUnique({
            where: { id: Number(userId) },
            select: { id: true, password: true, email: true },
        })

        if (!user || !user.password) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
            await logEvent(sessionId, 'STEP_UP_REQUIRED', {}, { req_rate_10s: 0 }, {})
            return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
        }

        // Successful step-up
        await logEvent(sessionId, 'STEP_UP_PASSED', {}, { req_rate_10s: 0 }, {})
        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('POST /api/auth/step-up error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
