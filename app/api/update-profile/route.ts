import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/event-logger'
import { verifyToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      first_name,
      last_name,
      phone,
      date_of_birth,
      gender,
      address_street,
      address_ward,
      address_city,
      address_country,
    } = body

    const userId = parseInt(id || '0')
    if (userId <= 0) {
      return NextResponse.json(
        { error: ['User ID is required.'] },
        { status: 400 }
      )
    }

    // Validation
    const errors: string[] = []
    if (!first_name?.trim()) errors.push('First name is required.')
    if (!last_name?.trim()) errors.push('Last name is required.')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        phone: phone?.trim() || '',
        dateOfBirth: date_of_birth ? new Date(date_of_birth) : null,
        gender: gender || null,
        addressStreet: address_street?.trim() || '',
        addressWard: address_ward?.trim() || '',
        addressCity: address_city?.trim() || '',
        addressCountry: address_country?.trim() || '',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        role: true,
        addressStreet: true,
        addressWard: true,
        addressCity: true,
        addressCountry: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Transform to snake_case for frontend compatibility
    const userData = {
      id: updatedUser.id,
      first_name: updatedUser.firstName,
      last_name: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      date_of_birth: updatedUser.dateOfBirth,
      gender: updatedUser.gender,
      role: updatedUser.role,
      address_street: updatedUser.addressStreet,
      address_ward: updatedUser.addressWard,
      address_city: updatedUser.addressCity,
      address_country: updatedUser.addressCountry,
      created_at: updatedUser.createdAt,
      updated_at: updatedUser.updatedAt,
    }

    // Log sensitive action (profile update)
    const token = request.cookies.get('session_token')?.value
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        await logEvent(String(payload.sessionId), 'API_CALL_SENSITIVE',
          {}, { endpoint_group: 'profile', status_group: '2xx' }, {})
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
      user: userData,
    })
  } catch (error) {
    console.error('POST /api/update-profile error:', error)
    return NextResponse.json(
      { error: ['Failed to update user.'], detail: String(error) },
      { status: 500 }
    )
  }
}
