import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/demo/session-events
 * Returns the 50 most recent session events for the current session.
 * Used by the demo lab live event feed.
 */
export async function GET(request: NextRequest) {
    try {
        const sessionId = request.headers.get('x-session-id')
            || request.cookies.get('session_id')?.value

        if (!sessionId) {
            return NextResponse.json({ error: 'No session' }, { status: 401 })
        }

        const events = await prisma.sessionEvent.findMany({
            where: { sessionId },
            orderBy: { ts: 'desc' },
            take: 60,
            select: {
                id: true,
                eventType: true,
                eventTypeId: true,
                deltaT_ms: true,
                flags: true,
                metrics: true,
                ts: true,
            },
        })

        return NextResponse.json({ events })
    } catch (error) {
        console.error('GET /api/demo/session-events error:', error)
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }
}
