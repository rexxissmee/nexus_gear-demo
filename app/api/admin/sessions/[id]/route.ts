import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revokeSession } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * GET /api/admin/sessions/[id]
 * Fetch full detail of a single session: events count + last audit log.
 */
export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await prisma.session.findUnique({
            where: { sessionId: params.id },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                auditLogs: { orderBy: { ts: 'desc' }, take: 5 },
                _count: { select: { events: true } },
            },
        })
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(session)
    } catch (err) {
        console.error('[Admin Session API] GET error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/sessions/[id]
 * Toggle tính năng rotation của session (rotationEnabled)
 */
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = params.id
        const body = await req.json()
        const { rotationEnabled } = body

        if (typeof rotationEnabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const session = await prisma.session.update({
            where: { sessionId },
            data: { rotationEnabled }
        })

        return NextResponse.json(session)
    } catch (err) {
        console.error('[Admin Session API] Error updating session:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/sessions/[id]
 * Admin-initiated session revocation.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await revokeSession(params.id, 'admin_manual_revoke')
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Admin Session API] DELETE error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
