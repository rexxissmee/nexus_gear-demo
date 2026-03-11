import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/session'
import { EXPIRY_SECONDS } from '@/lib/jwt'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/auth/passkey/login/verify
 * Xác minh authentication response từ browser, tạo JWT session.
 *
 * Body: AuthenticationResponseJSON từ @simplewebauthn/browser
 * Returns: { sessionId, expiresAt } + set cookie `session_token`
 */
export async function POST(request: NextRequest) {
    try {
        // Lấy challenge từ cookie
        const expectedChallenge = request.cookies.get('passkey_auth_challenge')?.value
        if (!expectedChallenge) {
            return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 })
        }

        const body = await request.json()

        // Tìm passkey theo credentialId
        const credentialId = Buffer.from(body.id, 'base64url')
        const passkey = await prisma.passkey.findUnique({
            where: { credentialId },
            include: {
                user: {
                    select: {
                        id: true, role: true, email: true,
                        firstName: true, lastName: true, phone: true,
                        dateOfBirth: true, gender: true,
                        addressStreet: true, addressWard: true,
                        addressCity: true, addressCountry: true,
                        createdAt: true, updatedAt: true,
                    }
                }
            },
        })

        if (!passkey) {
            return NextResponse.json({ error: 'Passkey not found' }, { status: 404 })
        }

        // Xác minh signature
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
                    // Parse transports từ JSON string
                    transports: passkey.transports
                        ? JSON.parse(passkey.transports)
                        : undefined,
                },
            })
        } catch (err) {
            console.error('verifyAuthenticationResponse error:', err)
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
        }

        if (!verification.verified) {
            return NextResponse.json({ error: 'Authentication not verified' }, { status: 401 })
        }

        // Cập nhật counter (chống replay attack)
        await prisma.passkey.update({
            where: { credentialId: passkey.credentialId },
            data: { counter: BigInt(verification.authenticationInfo.newCounter) },
        })

        // Tạo JWT session (dùng lại createSession từ lib/session.ts)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
        const ua = request.headers.get('user-agent') || ''

        const session = await createSession({
            userId: passkey.user.id,
            role: passkey.user.role,
            ip,
            ua,
        })

        const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000)

        // Set cookies giống login thường
        const response = NextResponse.json({
            success: true,
            sessionId: session.sessionId,
            expiresAt: session.expiresAt.toISOString(),
            user: {
                id: passkey.user.id,
                first_name: passkey.user.firstName,
                last_name: passkey.user.lastName ?? null,
                email: passkey.user.email,
                phone: passkey.user.phone ?? null,
                date_of_birth: passkey.user.dateOfBirth?.toISOString() ?? null,
                gender: passkey.user.gender ?? null,
                role: passkey.user.role,
                address_street: passkey.user.addressStreet ?? null,
                address_ward: passkey.user.addressWard ?? null,
                address_city: passkey.user.addressCity ?? null,
                address_country: passkey.user.addressCountry ?? null,
                created_at: passkey.user.createdAt.toISOString(),
                updated_at: passkey.user.updatedAt.toISOString(),
            },
        })

        response.cookies.set('session_token', session.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: expiresAt,
        })
        response.cookies.set('session_id', session.sessionId, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: expiresAt,
        })
        // Xoá challenge cookie
        response.cookies.set('passkey_auth_challenge', '', { maxAge: 0, path: '/' })

        return response

    } catch (error) {
        console.error('POST /api/auth/passkey/login/verify:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
