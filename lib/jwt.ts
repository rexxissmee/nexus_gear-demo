import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'nexus-gear-session-hijacking-mvp-secret-key-change-in-prod'
)

const EXPIRY_SECONDS = 60 * 60 * 2 // 2 hours

export interface SessionJWTPayload extends JWTPayload {
    sessionId: string
    userId: number
    role: string
}

/** Sign a new JWT for a session */
export async function signToken(payload: Omit<SessionJWTPayload, 'iat' | 'exp'>): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${EXPIRY_SECONDS}s`)
        .sign(JWT_SECRET)
}

/** Verify a JWT and return the payload, or null if invalid/expired */
export async function verifyToken(token: string): Promise<SessionJWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as SessionJWTPayload
    } catch {
        return null
    }
}

/** Hash a token using Web Crypto API (SHA-256, Edge Runtime compatible) */
export async function hashToken(token: string): Promise<string> {
    const data = new TextEncoder().encode(token)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Generate a unique session ID using Web Crypto API */
export function generateSessionId(): string {
    const bytes = new Uint8Array(20)
    globalThis.crypto.getRandomValues(bytes)
    return `sess_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

/** Bucket an IP to first 3 octets (non-PII: 192.168.1.x → "192.168.1") */
export function bucketIp(ip: string): string {
    if (!ip) return 'unknown'
    const parts = ip.replace('::ffff:', '').split('.')
    if (parts.length === 4) return parts.slice(0, 3).join('.')
    return 'ipv6'
}

/** Bucket UA to browser family + OS only (non-PII) */
export function bucketUa(ua: string): string {
    if (!ua) return 'unknown'
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge|OPR)\/[\d.]+/)?.[1] ?? 'other'
    const os = ua.match(/(Windows|Mac|Linux|Android|iOS)/i)?.[1] ?? 'other'
    return `${browser}/${os}`.toLowerCase()
}

export { EXPIRY_SECONDS }

