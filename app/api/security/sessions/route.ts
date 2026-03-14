import { NextRequest, NextResponse } from 'next/server'
import { getActiveSessions, revokeSession } from '@/lib/session'
import { logEvent } from '@/lib/event-logger'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/security/sessions
 * Returns active sessions for the currently authenticated user.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = Number(request.headers.get('x-user-id'))
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const sessions = await getActiveSessions(userId)
        const currentSessionId = request.headers.get('x-session-id') || ''

        // Log sensitive: viewing active sessions
        if (currentSessionId) {
            await logEvent(currentSessionId, 'API_CALL_SENSITIVE',
                {}, { endpoint_group: 'security', status_group: '2xx' }, {})
        }

        return NextResponse.json({
            success: true,
            sessions: sessions.map(s => ({
                ...s,
                isCurrent: s.sessionId === currentSessionId,
            })),
        })
    } catch (error) {
        console.error('GET /api/security/sessions error:', error)
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }
}

/**
 * DELETE /api/security/sessions
 * Body: { sessionId: string } – revoke a specific session.
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = Number(request.headers.get('x-user-id'))
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { sessionId } = body

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
        }

        // Ownership check: session phải thuộc về user đang request
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { userId: true, revokedAt: true },
        })
        if (!session || session.userId !== userId) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }
        if (session.revokedAt) {
            return NextResponse.json({ error: 'Session already revoked' }, { status: 409 })
        }

        await revokeSession(sessionId, 'user_manual_revoke')

        return NextResponse.json({ success: true, message: 'Session revoked.' })
    } catch (error) {
        console.error('DELETE /api/security/sessions error:', error)
        return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
    }
}
