import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'

/**
 * GET /api/auth/passkey/list
 * Trả về danh sách passkeys của user hiện tại.
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

        const passkeys = await prisma.passkey.findMany({
            where: { userId: Number(payload.userId) },
            select: { id: true, name: true, createdAt: true, transports: true },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ passkeys })

    } catch (error) {
        console.error('GET /api/auth/passkey/list:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
