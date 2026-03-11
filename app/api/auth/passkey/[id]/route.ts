import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'

type Params = Promise<{ id: string }>

/**
 * DELETE /api/auth/passkey/[id]
 * Xoá passkey của user hiện tại theo id (autoincrement).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Params }
) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

        const { id: rawId } = await params
        const passkeyId = parseInt(rawId)
        if (isNaN(passkeyId)) {
            return NextResponse.json({ error: 'Invalid passkey ID' }, { status: 400 })
        }

        const passkey = await prisma.passkey.findFirst({
            where: { id: passkeyId, userId: Number(payload.userId) },
        })

        if (!passkey) {
            return NextResponse.json({ error: 'Passkey not found' }, { status: 404 })
        }

        await prisma.passkey.delete({ where: { id: passkeyId } })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('DELETE /api/auth/passkey/[id]:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /api/auth/passkey/list — List all passkeys of current user
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Params }
) {
    const { id } = await params
    if (id !== 'list') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

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
        console.error('GET /api/auth/passkey/[id]:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
