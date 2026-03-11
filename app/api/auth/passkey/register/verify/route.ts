import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'
import { logEvent } from '@/lib/event-logger'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/auth/passkey/register/verify
 * Xác minh WebAuthn registration response và lưu passkey vào DB.
 *
 * Body: RegistrationResponseJSON từ @simplewebauthn/browser
 * Query: ?name=My%20Phone (tên passkey do user đặt, tuỳ chọn)
 */
export async function POST(request: NextRequest) {
    try {
        // Xác thực user đang login
        const token = request.cookies.get('session_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        // Lấy challenge từ cookie
        const expectedChallenge = request.cookies.get('passkey_reg_challenge')?.value
        if (!expectedChallenge) {
            return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 })
        }

        const body = await request.json()
        const passkeyName = request.nextUrl.searchParams.get('name') || null

        // Xác minh với @simplewebauthn/server
        let verification
        try {
            verification = await verifyRegistrationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: ORIGIN,
                expectedRPID: RP_ID,
            })
        } catch (err) {
            console.error('verifyRegistrationResponse error:', err)
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
        }

        if (!verification.verified || !verification.registrationInfo) {
            return NextResponse.json({ error: 'Registration not verified' }, { status: 400 })
        }

        const { credential } = verification.registrationInfo

        // Lưu passkey vào DB
        await prisma.passkey.create({
            data: {
                userId: Number(payload.userId),
                credentialId: Buffer.from(credential.id, 'base64url'),   // decode base64url → raw bytes
                publicKey: Buffer.from(credential.publicKey),              // đã là Uint8Array raw bytes
                counter: BigInt(credential.counter),
                transports: body.response?.transports
                    ? JSON.stringify(body.response.transports)
                    : null,
                name: passkeyName,
            },
        })

        // Log sensitive: new passkey registered
        await logEvent(String(payload.sessionId), 'API_CALL_SENSITIVE',
            {}, { endpoint_group: 'auth', status_group: '2xx' }, { method: 'passkey_register' })

        // Xoá challenge cookie
        const response = NextResponse.json({ verified: true })
        response.cookies.set('passkey_reg_challenge', '', { maxAge: 0, path: '/' })
        return response

    } catch (error) {
        console.error('POST /api/auth/passkey/register/verify:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
