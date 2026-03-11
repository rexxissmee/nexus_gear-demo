import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'

/**
 * GET /api/auth/passkey/login/options
 * Tạo WebAuthn authentication challenge cho đăng nhập.
 * Query: ?email=user@example.com (tuỳ chọn — nếu có thì gợi ý credentials của user đó)
 *
 * Lưu challenge vào cookie tạm `passkey_auth_challenge`.
 */
export async function GET(request: NextRequest) {
    try {
        const email = request.nextUrl.searchParams.get('email')

        let allowCredentials: { id: string; type: 'public-key' }[] = []

        // Nếu có email, load credentials của user đó để gợi ý platform authenticator
        if (email) {
            const user = await prisma.user.findUnique({
                where: { email },
                include: { passkeys: { select: { credentialId: true } } },
            })
            if (user?.passkeys.length) {
                allowCredentials = user.passkeys.map(pk => ({
                    id: Buffer.from(pk.credentialId).toString('base64url'),
                    type: 'public-key' as const,
                }))
            }
        }
        // Nếu không có email: discoverable credential (resident key) — browser tự hỏi

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials,
            userVerification: 'preferred',
        })

        const response = NextResponse.json(options)
        response.cookies.set('passkey_auth_challenge', options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30,
        })
        return response

    } catch (error) {
        console.error('GET /api/auth/passkey/login/options:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
