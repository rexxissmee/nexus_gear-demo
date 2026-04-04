import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/admin/sessions
 * List sessions with search, filter by status, pagination.
 * Query params:
 *   ?status=active|revoked|all  (default: all)
 *   ?search=<email or sessionId fragment>
 *   ?page=1  &limit=20
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status  = searchParams.get('status') ?? 'all'
        const search  = searchParams.get('search') ?? ''
        const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
        const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
        const skip    = (page - 1) * limit

        const now = new Date()

        type WhereClause = {
            revokedAt?: null | { not: null }
            expiresAt?: { gt: Date } | { lte: Date }
            OR?: Array<{
                sessionId?: { contains: string; mode: 'insensitive' }
                user?: { email?: { contains: string; mode: 'insensitive' } }
            }>
        }

        const where: WhereClause = {}
        if (status === 'active') {
            // Active = not revoked AND not expired
            where.revokedAt = null
            where.expiresAt = { gt: now }
        } else if (status === 'revoked') {
            where.revokedAt = { not: null }
        } else if (status === 'expired') {
            // Expired = not revoked but past expiresAt
            where.revokedAt = null
            where.expiresAt = { lte: now }
        }
        if (search.trim()) {
            where.OR = [
                { sessionId: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ]
        }

        const [sessions, total] = await Promise.all([
            prisma.session.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    _count: { select: { events: true, auditLogs: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.session.count({ where }),
        ])

        return NextResponse.json({
            sessions,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        })
    } catch (err) {
        console.error('[Admin Sessions API] GET error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
