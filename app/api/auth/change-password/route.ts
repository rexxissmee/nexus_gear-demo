import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'
import { logEvent } from '@/lib/event-logger'

/**
 * POST /api/auth/change-password
 * Đổi mật khẩu của user đang đăng nhập.
 *
 * Body: { currentPassword: string, newPassword: string }
 * Yêu cầu: session_token cookie hợp lệ.
 */
export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
        }

        const body = await request.json()
        const { currentPassword, newPassword } = body

        // Validate input
        if (!currentPassword || typeof currentPassword !== 'string') {
            return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
        }
        if (!newPassword || typeof newPassword !== 'string') {
            return NextResponse.json({ error: 'New password is required' }, { status: 400 })
        }
        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
        }
        if (currentPassword === newPassword) {
            return NextResponse.json({ error: 'New password must differ from current password' }, { status: 400 })
        }

        // Lấy user từ DB
        const user = await prisma.user.findUnique({
            where: { id: Number(payload.userId) },
            select: { id: true, password: true },
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Xác minh mật khẩu hiện tại
        const isValid = await bcrypt.compare(currentPassword, user.password)
        if (!isValid) {
            await logEvent(String(payload.sessionId), 'API_CALL_SENSITIVE',
                {}, { endpoint_group: 'auth', status_group: '4xx' }, {})
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
        }

        // Hash mật khẩu mới
        const hashed = await bcrypt.hash(newPassword, 12)

        // Cập nhật DB
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        })

        // Log sự kiện nhạy cảm
        await logEvent(String(payload.sessionId), 'API_CALL_SENSITIVE',
            {}, { endpoint_group: 'auth', status_group: '2xx' }, {})

        return NextResponse.json({ success: true, message: 'Password changed successfully' })

    } catch (error) {
        console.error('POST /api/auth/change-password:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
