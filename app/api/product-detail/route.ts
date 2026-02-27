import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('id') || '0')

    if (productId <= 0) {
      return NextResponse.json(
        { error: ['Valid product id is required.'] },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        images: {
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: ['Product not found.'] },
        { status: 404 }
      )
    }

    const productData = {
      ...product,
      price: Number(product.price),
      originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
      averageRating: Number(product.averageRating),
      category_name: product.category?.name,
    }

    const imagesList = product.images.map((img) => ({
      id: img.id,
      image_url: img.imageUrl,
    }))

    return NextResponse.json({
      success: true,
      data: {
        product: productData,
        images: imagesList,
      },
    })
  } catch (error) {
    console.error('GET /api/product-detail error:', error)
    return NextResponse.json(
      { error: ['Database error'], detail: String(error) },
      { status: 500 }
    )
  }
}
