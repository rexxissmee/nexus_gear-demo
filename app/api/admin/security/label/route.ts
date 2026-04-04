import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/security/label
 * Đánh dấu nhãn thủ công cho một session từ Admin UI.
 * Nhãn này sẽ được dùng cho ML training bằng cách quét biến `revokeReason`  (thực hiện qua `label_builder.py`).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { sessionId, label } = body

        if (!sessionId || !label) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const reasonStr = `ADMIN_LABEL:${label.toUpperCase()} – manual_review`

        // Tái lập SessionEvent: Thêm event loại ADMIN_SESSION_LABEL vào database
        await prisma.sessionEvent.create({
            data: {
                sessionId: sessionId,
                eventType: 'ADMIN_SESSION_LABEL',
                eventTypeId: 19,
                flags: { label },
                metrics: {},
                config: {},
                deltaT_ms: 0,
                ts: new Date()
            }
        })

        if (label === 'ATTACK') {
            // Revoke nó luôn nếu là Attack để đánh dấu
            await prisma.session.update({
                where: { sessionId: sessionId },
                data: {
                    revokedAt: new Date(),
                    revokeReason: reasonStr
                }
            })
        } else if (label === 'NORMAL') {
            // Đánh dấu là NORMAL (Nếu có bị revoke nhầm thì xoá revoke đi)
            await prisma.session.update({
                where: { sessionId: sessionId },
                data: {
                    revokeReason: reasonStr,
                    revokedAt: null
                }
            })
        }

        return NextResponse.json({ success: true, message: `Labeled ${sessionId} as ${label}` })
    } catch (err) {
        console.error('[Admin Label API] Error labeling session:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
