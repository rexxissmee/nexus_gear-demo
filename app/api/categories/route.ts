import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/categories - Get all categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('GET /api/categories error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const name = data.name?.trim() || ''
    const description = data.description?.trim() || ''
    const status = data.status || 'active'

    // Validation
    const errors: string[] = []
    if (name === '') errors.push('Category name is required.')
    if (!['active', 'inactive'].includes(status)) errors.push('Invalid status.')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        status,
        createdAt: new Date(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Category created successfully.',
        data: category,
      },
      { status: 201 }
    )
  } catch (error) {
    // Handle unique constraint error
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: ['Category name already exists.'] },
          { status: 500 }
        )
      }
    }

    console.error('POST /api/categories error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT/PATCH /api/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const id = parseInt(data.id) || 0
    const name = data.name !== undefined ? data.name?.trim() : undefined
    const description = data.description !== undefined ? data.description?.trim() : undefined
    const status = data.status

    // Validation
    const errors: string[] = []
    if (id <= 0) errors.push('Valid category id is required.')
    if (status !== undefined && !['active', 'inactive'].includes(status)) errors.push('Invalid status.')
    if (name !== undefined && name === '') errors.push('Category name cannot be empty.')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Build update data
    const updateData: Prisma.CategoryUpdateInput = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (status !== undefined) updateData.status = status

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: ['No fields to update.'] }, { status: 400 })
    }

    // Update category
    await prisma.category.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'Category updated successfully.',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: ['Category name already exists.'] }, { status: 500 })
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: ['Category not found.'] }, { status: 404 })
      }
    }

    console.error('PUT /api/categories error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH is alias for PUT
export const PATCH = PUT

// DELETE /api/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let id = parseInt(searchParams.get('id') || '0')

    // Also check body if not in query string
    if (id <= 0) {
      const data = await request.json().catch(() => ({}))
      id = parseInt(data.id) || 0
    }

    if (id <= 0) {
      return NextResponse.json({ error: ['Valid category id is required.'] }, { status: 400 })
    }

    // Delete category
    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully.',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: ['Category not found.'] }, { status: 404 })
      }
    }

    console.error('DELETE /api/categories error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
