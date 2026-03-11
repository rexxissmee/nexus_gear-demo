import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const RP_NAME = process.env.NEXT_PUBLIC_RP_NAME || 'Nexus Gear'

/**
 * GET /api/auth/passkey/register/options
 * Tạo WebAuthn registration challenge cho user đang đăng nhập.
 * Lưu challenge vào cookie tạm thời `passkey_reg_challenge`.
 */
export async function GET(request: NextRequest) {
    try {
        // Xác thực user đang login qua JWT cookie
        const token = request.cookies.get('session_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(payload.userId) },
            select: { id: true, email: true, firstName: true, lastName: true, passkeys: true },
        })
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Lấy danh sách credentials đã đăng ký để loại bỏ trùng lặp
        const excludeCredentials = user.passkeys.map(pk => ({
            id: Buffer.from(pk.credentialId).toString('base64url'),
            type: 'public-key' as const,
        }))

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: Buffer.from(String(user.id)),
            userName: user.email,
            userDisplayName: `${user.firstName} ${user.lastName ?? ''}`.trim(),
            excludeCredentials,
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        })

        // Lưu challenge vào cookie (30 giây TTL)
        const response = NextResponse.json(options)
        response.cookies.set('passkey_reg_challenge', options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30,
        })
        return response

    } catch (error) {
        console.error('GET /api/auth/passkey/register/options:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
