import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/session'
import { logEvent } from '@/lib/event-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validation
    const errors: string[] = []
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email is required.')
    }
    if (!password) {
      errors.push('Password is required.')
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: ['Invalid email or password.'] }, { status: 401 })
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password)

    if (!passwordValid) {
      return NextResponse.json({ error: ['Invalid email or password.'] }, { status: 401 })
    }

    // Get client metadata for non-PII bucketing
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || ''
    const ua = request.headers.get('user-agent') || ''

    // Create JWT session
    const { token, sessionId, expiresAt } = await createSession({
      userId: user.id,
      role: user.role,
      rotationEnabled: true,
      ip,
      ua,
    })

    // Log AUTH_LOGIN_SUCCESS
    await logEvent(sessionId, 'AUTH_LOGIN_SUCCESS', {}, {
      endpoint_group: 'auth',
      status_group: '2xx',
    }, { rotation_enabled: true })

    // Return user data (exclude password)
    const { password: _, ...userWithoutPassword } = user
    const userData = {
      id: userWithoutPassword.id,
      first_name: userWithoutPassword.firstName,
      last_name: userWithoutPassword.lastName,
      email: userWithoutPassword.email,
      phone: userWithoutPassword.phone,
      date_of_birth: userWithoutPassword.dateOfBirth,
      gender: userWithoutPassword.gender,
      role: userWithoutPassword.role,
      address_street: userWithoutPassword.addressStreet,
      address_ward: userWithoutPassword.addressWard,
      address_city: userWithoutPassword.addressCity,
      address_country: userWithoutPassword.addressCountry,
      created_at: userWithoutPassword.createdAt,
      updated_at: userWithoutPassword.updatedAt,
    }

    const response = NextResponse.json({
      success: true,
      message: 'Login successful.',
      user: userData,
      sessionId,
      expiresAt: expiresAt.toISOString(),
    })

    // Set httpOnly session cookie (non-JS accessible)
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
    response.cookies.set('session_id', sessionId, {
      httpOnly: false, // readable by client for API calls
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })

    return response
  } catch (error) {
    console.error('POST /api/login error:', error)
    return NextResponse.json(
      { error: ['Login failed.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

