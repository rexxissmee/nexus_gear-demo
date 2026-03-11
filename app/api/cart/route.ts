import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logEvent } from '@/lib/event-logger'

// GET /api/cart?user_id=1 - Get cart items for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = parseInt(searchParams.get('user_id') || '0')

    if (userId <= 0) {
      return NextResponse.json({ error: ['Valid user_id is required.'] }, { status: 400 })
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    // Filter out items with deleted products
    const items = cartItems
      .filter(item => item.product !== null)
      .map(item => ({
        cart_item_id: item.id,
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        originalPrice: item.product.originalPrice ? Number(item.product.originalPrice) : null,
        image: item.product.thumbnail || '/placeholder.svg?height=300&width=300',
        category: item.product.category?.name || 'Other',
        quantity: item.quantity,
      }))

    // Log normal API activity
    const sessionId = request.cookies.get('session_id')?.value
    if (sessionId) {
      await logEvent(sessionId, 'API_CALL_NORMAL',
        {}, { endpoint_group: 'cart', status_group: '2xx' }, {})
    }

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    console.error('GET /api/cart error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add, update, remove, or clear cart
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const action = data.action || 'add'
    const userId = parseInt(data.user_id) || 0

    if (userId <= 0) {
      return NextResponse.json({ error: ['Valid user_id is required.'] }, { status: 400 })
    }

    // ADD to cart
    if (action === 'add') {
      const productId = parseInt(data.product_id) || 0
      const quantity = parseInt(data.quantity) || 1

      if (productId <= 0) {
        return NextResponse.json({ error: ['Valid product_id is required.'] }, { status: 400 })
      }

      // Check if already in cart
      const existing = await prisma.cartItem.findFirst({
        where: { userId, productId },
      })

      if (existing) {
        // Update quantity
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        })
      } else {
        // Create new cart item
        await prisma.cartItem.create({
          data: {
            userId,
            productId,
            quantity,
          },
        })
      }

      const addSessionId = request.cookies.get('session_id')?.value
      if (addSessionId) {
        await logEvent(addSessionId, 'API_CALL_NORMAL',
          {}, { endpoint_group: 'cart', status_group: '2xx' }, {})
      }
      return NextResponse.json({
        success: true,
        message: 'Product added to cart successfully.',
      })
    }

    // UPDATE cart item quantity
    if (action === 'update') {
      const cartItemId = parseInt(data.cart_item_id) || 0
      const quantity = parseInt(data.quantity) || 1

      if (cartItemId <= 0) {
        return NextResponse.json({ error: ['Valid cart_item_id is required.'] }, { status: 400 })
      }

      if (quantity < 1) {
        return NextResponse.json({ error: ['Quantity must be at least 1.'] }, { status: 400 })
      }

      await prisma.cartItem.update({
        where: { id: cartItemId, userId }, // Ensure it belongs to the user
        data: { quantity },
      })

      const updateSessionId = request.cookies.get('session_id')?.value
      if (updateSessionId) {
        await logEvent(updateSessionId, 'API_CALL_NORMAL',
          {}, { endpoint_group: 'cart', status_group: '2xx' }, {})
      }
      return NextResponse.json({
        success: true,
        message: 'Cart updated successfully.',
      })
    }

    // REMOVE cart item
    if (action === 'remove') {
      const cartItemId = parseInt(data.cart_item_id) || 0

      if (cartItemId <= 0) {
        return NextResponse.json({ error: ['Valid cart_item_id is required.'] }, { status: 400 })
      }

      await prisma.cartItem.delete({
        where: { id: cartItemId, userId }, // Ensure it belongs to the user
      })

      const removeSessionId = request.cookies.get('session_id')?.value
      if (removeSessionId) {
        await logEvent(removeSessionId, 'API_CALL_NORMAL',
          {}, { endpoint_group: 'cart', status_group: '2xx' }, {})
      }
      return NextResponse.json({
        success: true,
        message: 'Item removed from cart successfully.',
      })
    }

    // CLEAR all cart items for user
    if (action === 'clear') {
      await prisma.cartItem.deleteMany({
        where: { userId },
      })

      const clearSessionId = request.cookies.get('session_id')?.value
      if (clearSessionId) {
        await logEvent(clearSessionId, 'API_CALL_NORMAL',
          {}, { endpoint_group: 'cart', status_group: '2xx' }, {})
      }
      return NextResponse.json({
        success: true,
        message: 'Cart cleared successfully.',
      })
    }

    return NextResponse.json({ error: ['Invalid action.'] }, { status: 400 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: ['Cart item not found.'] }, { status: 404 })
    }

    console.error('POST /api/cart error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Remove item from cart
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cartItemId = parseInt(searchParams.get('cart_item_id') || '0')
    const userId = parseInt(searchParams.get('user_id') || '0')

    if (cartItemId <= 0 || userId <= 0) {
      return NextResponse.json(
        { error: ['Valid cart_item_id and user_id are required.'] },
        { status: 400 }
      )
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId, userId },
    })

    return NextResponse.json({
      success: true,
      message: 'Item removed from cart successfully.',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: ['Cart item not found.'] }, { status: 404 })
    }

    console.error('DELETE /api/cart error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
