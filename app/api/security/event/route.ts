import { NextRequest, NextResponse } from 'next/server'
import { logEvent, type EventType } from '@/lib/event-logger'

/**
 * POST /api/security/event
 * Receives client-side flag events (IP change, UA change, etc.)
 * and logs them to the session event store.
 */
export async function POST(request: NextRequest) {
    try {
        const sessionId = request.headers.get('x-session-id')
            || request.cookies.get('session_id')?.value

        if (!sessionId) {
            return NextResponse.json({ error: 'No session' }, { status: 401 })
        }

        const body = await request.json()
        const { event_type, flags = {}, metrics = {}, config = {} } = body

        const ALLOWED_EVENTS: EventType[] = [
            'FLAG_IP_CHANGE', 'FLAG_UA_CHANGE', 'FLAG_DEVICE_CHANGE', 'FLAG_GEO_CHANGE',
            'SESSION_IDLE_LONG', 'REQUEST_BURST', 'STATUS_401', 'STATUS_403',
        ]

        if (!event_type || !ALLOWED_EVENTS.includes(event_type)) {
            return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
        }

        await logEvent(sessionId, event_type as EventType, flags, metrics, config)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('POST /api/security/event error:', error)
        return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
    }
}
