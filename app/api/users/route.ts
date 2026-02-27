import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = parseInt(searchParams.get('id') || '0')

    if (userId > 0) {
      // Get single user with aggregates
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
      })

      if (!user) {
        return NextResponse.json(
          { error: ['User not found.'] },
          { status: 404 }
        )
      }

      // Get total spent
      const orderAgg = await prisma.order.aggregate({
        where: { userId },
        _sum: { total: true },
      })

      return NextResponse.json({
        success: true,
        data: {
          id: user.id,
          name: `${user.firstName} ${user.lastName || ''}`.trim(),
          email: user.email,
          phone: user.phone,
          role: user.role,
          joined: user.createdAt,
          orders: user._count.orders,
          total_spent: Number(orderAgg._sum.total || 0),
        },
      })
    }

    // Get all users with aggregates
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        orders: {
          select: {
            total: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const usersList = users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName || ''}`.trim(),
      email: u.email,
      phone: u.phone,
      role: u.role,
      joined: u.createdAt,
      orders: u.orders.length,
      total_spent: u.orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    }))

    return NextResponse.json({
      success: true,
      data: usersList,
    })
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { error: ['Database error'], detail: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'update') {
      const userId = parseInt(body.id || '0')
      if (userId <= 0) {
        return NextResponse.json(
          { error: ['Valid user id is required.'] },
          { status: 400 }
        )
      }

      const updateData: any = {}
      if (body.first_name !== undefined) updateData.firstName = body.first_name.trim()
      if (body.last_name !== undefined)
        updateData.lastName = body.last_name.trim() || null
      if (body.email !== undefined) updateData.email = body.email.trim()
      if (body.phone !== undefined) updateData.phone = body.phone.trim()
      if (body.role !== undefined)
        updateData.role = body.role === 'admin' ? 'admin' : 'user'

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: ['No fields to update.'] },
          { status: 400 }
        )
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        message: 'User updated successfully.',
      })
    }

    if (action === 'delete') {
      const userId = parseInt(body.id || '0')
      if (userId <= 0) {
        return NextResponse.json(
          { error: ['Valid user id is required.'] },
          { status: 400 }
        )
      }

      await prisma.user.delete({
        where: { id: userId },
      })

      return NextResponse.json({
        success: true,
        message: 'User deleted successfully.',
      })
    }

    return NextResponse.json({ error: ['Invalid action.'] }, { status: 400 })
  } catch (error) {
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { error: ['Database error'], detail: String(error) },
      { status: 500 }
    )
  }
}
