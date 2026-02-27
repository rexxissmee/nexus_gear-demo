import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      agree,
    } = body

    // Validation
    const errors: string[] = []
    if (!firstName?.trim()) errors.push('First name is required.')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email is required.')
    }
    if (!phone?.trim()) errors.push('Phone number is required.')
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters.')
    }
    if (password !== confirmPassword) {
      errors.push('Passwords do not match.')
    }
    if (!agree) {
      errors.push('You must agree to the terms.')
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: ['Email already exists.'] },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        email: email.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        role: 'user',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Registration successful.',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: ['Registration failed.'] },
      { status: 500 }
    )
  }
}
