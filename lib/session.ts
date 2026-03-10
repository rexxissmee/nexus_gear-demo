import { prisma } from '@/lib/prisma'
import {
    signToken,
    hashToken,
    generateSessionId,
    bucketIp,
    bucketUa,
    EXPIRY_SECONDS,
    type SessionJWTPayload,
} from '@/lib/jwt'
import { logEvent, logAuditAction } from '@/lib/event-logger'

export interface CreateSessionOptions {
    userId: number
    role: string
    rotationEnabled?: boolean
    ip?: string
    ua?: string
}

export interface SessionResult {
    token: string
    sessionId: string
    expiresAt: Date
}

/**
 * Create a new session + issue JWT token
 */
export async function createSession(opts: CreateSessionOptions): Promise<SessionResult> {
    const { userId, role, rotationEnabled = true, ip = '', ua = '' } = opts
    const sessionId = generateSessionId()
    const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000)

    const token = await signToken({ sessionId, userId, role })
    const tokenHash = await hashToken(token)

    await prisma.session.create({
        data: {
            sessionId,
            userId,
            tokenHash,
            rotationEnabled,
            expiresAt,
            ipBucket: bucketIp(ip),
            uaBucket: bucketUa(ua),
        },
    })

    await logEvent(sessionId, 'TOKEN_ISSUE', {}, {
        endpoint_group: 'auth',
        status_group: '2xx',
    }, { rotation_enabled: rotationEnabled })

    return { token, sessionId, expiresAt }
}

/**
 * Refresh or rotate a session token.
 * If rotationEnabled: invalidate old token, issue new one (TOKEN_ROTATE).
 * Otherwise: just extend expiry (TOKEN_REFRESH).
 */
export async function refreshSession(
    sessionId: string,
    currentToken: string,
    ip?: string,
    ua?: string
): Promise<SessionResult | null> {
    const session = await prisma.session.findUnique({
        where: { sessionId },
        include: { user: { select: { id: true, role: true } } },
    })

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return null
    }

    // Verify token hash matches
    const currentHash = await hashToken(currentToken)
    if (currentHash !== session.tokenHash) return null

    const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000)
    const newToken = await signToken({ sessionId, userId: session.userId, role: session.user.role })
    const newHash = await hashToken(newToken)

    // Detect IP/UA changes (flag only, non-PII)
    const newIpBucket = bucketIp(ip ?? '')
    const newUaBucket = bucketUa(ua ?? '')
    const ipChanged = session.ipBucket && session.ipBucket !== newIpBucket ? 1 : 0
    const uaChanged = session.uaBucket && session.uaBucket !== newUaBucket ? 1 : 0

    await prisma.session.update({
        where: { sessionId },
        data: {
            tokenHash: newHash,
            expiresAt,
            ipBucket: newIpBucket,
            uaBucket: newUaBucket,
        },
    })

    const eventType = session.rotationEnabled ? 'TOKEN_ROTATE' : 'TOKEN_REFRESH'
    await logEvent(sessionId, eventType,
        { ip_change: ipChanged, ua_change: uaChanged },
        { endpoint_group: 'auth', status_group: '2xx' },
        { rotation_enabled: session.rotationEnabled }
    )

    if (session.rotationEnabled) {
        await logAuditAction(sessionId, 'TOKEN_ROTATE', 'Scheduled token rotation')
    }

    if (ipChanged) await logEvent(sessionId, 'FLAG_IP_CHANGE', { ip_change: 1 })
    if (uaChanged) await logEvent(sessionId, 'FLAG_UA_CHANGE', { ua_change: 1 })

    return { token: newToken, sessionId, expiresAt }
}

/**
 * Revoke a session (manual logout or policy action)
 */
export async function revokeSession(
    sessionId: string,
    reason: string = 'manual_logout'
): Promise<void> {
    const session = await prisma.session.findUnique({ where: { sessionId } })
    if (!session || session.revokedAt) return

    await prisma.session.update({
        where: { sessionId },
        data: { revokedAt: new Date(), revokeReason: reason },
    })

    await logEvent(sessionId, 'TOKEN_REVOKE', {}, {}, {})
    await logEvent(sessionId, 'AUTH_LOGOUT', {}, { endpoint_group: 'auth' }, {})
    await logAuditAction(sessionId, 'REVOKE', reason)
}

/**
 * Get active sessions for a user (not revoked, not expired)
 */
export async function getActiveSessions(userId: number) {
    return prisma.session.findMany({
        where: {
            userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: {
            sessionId: true,
            rotationEnabled: true,
            ipBucket: true,
            uaBucket: true,
            createdAt: true,
            expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
    })
}

/**
 * Validate a session from a JWT payload vs DB record
 */
export async function validateSession(payload: SessionJWTPayload, token: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
        where: { sessionId: payload.sessionId },
    })
    if (!session) return false
    if (session.revokedAt) return false
    if (session.expiresAt < new Date()) return false
    if (await hashToken(token) !== session.tokenHash) return false
    return true
}
