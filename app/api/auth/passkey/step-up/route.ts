import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'
import { logEvent } from '@/lib/event-logger'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/auth/passkey/step-up/options
 * Tạo challenge để xác thực step-up bằng Passkey.
 * Chỉ load credentials của user trong session hiện tại.
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

        // Load passkeys của user hiện tại
        const passkeys = await prisma.passkey.findMany({
            where: { userId: Number(payload.userId) },
            select: { credentialId: true },
        })

        if (!passkeys.length) {
            return NextResponse.json({ error: 'No passkeys registered' }, { status: 404 })
        }

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials: passkeys.map(pk => ({
                id: Buffer.from(pk.credentialId).toString('base64url'),
                type: 'public-key' as const,
            })),
            userVerification: 'required', // Step-up yêu cầu biometric/PIN bắt buộc
        })

        const response = NextResponse.json(options)
        response.cookies.set('passkey_stepup_challenge', options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30,
        })
        return response

    } catch (error) {
        console.error('GET /api/auth/passkey/step-up/options:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/auth/passkey/step-up/verify
 * Xác minh step-up bằng Passkey.
 * Nếu thành công log STEP_UP_PASSED — giống step-up/password route.
 */
export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('session_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

        const expectedChallenge = request.cookies.get('passkey_stepup_challenge')?.value
        if (!expectedChallenge) {
            return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 })
        }

        const body = await request.json()

        const credentialId = Buffer.from(body.id, 'base64url')
        const passkey = await prisma.passkey.findUnique({
            where: { credentialId },
        })

        if (!passkey || passkey.userId !== Number(payload.userId)) {
            await logEvent(String(payload.sessionId), 'STEP_UP_REQUIRED', {}, { req_rate_10s: 0 }, {})
            return NextResponse.json({ error: 'Passkey not found' }, { status: 404 })
        }

        let verification
        try {
            verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: ORIGIN,
                expectedRPID: RP_ID,
                credential: {
                    id: Buffer.from(passkey.credentialId).toString('base64url'),
                    publicKey: new Uint8Array(passkey.publicKey),
                    counter: Number(passkey.counter),
                    transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
                },
            })
        } catch (err) {
            console.error('step-up verifyAuthenticationResponse error:', err)
            await logEvent(String(payload.sessionId), 'STEP_UP_REQUIRED', {}, { req_rate_10s: 0 }, {})
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
        }

        if (!verification.verified) {
            return NextResponse.json({ error: 'Step-up not verified' }, { status: 401 })
        }

        // Cập nhật counter
        await prisma.passkey.update({
            where: { credentialId: passkey.credentialId },
            data: { counter: BigInt(verification.authenticationInfo.newCounter) },
        })

        await logEvent(String(payload.sessionId), 'STEP_UP_PASSED', {}, { req_rate_10s: 0 }, { method: 'passkey' })

        const response = NextResponse.json({ success: true })
        response.cookies.set('passkey_stepup_challenge', '', { maxAge: 0, path: '/' })
        return response

    } catch (error) {
        console.error('POST /api/auth/passkey/step-up/verify:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
