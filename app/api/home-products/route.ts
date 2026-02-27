import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'featured'

    let products: any[] = []

    if (type === 'featured') {
      products = await prisma.product.findMany({
        where: { isFeatured: true },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      })
    } else if (type === 'new_arrivals') {
      products = await prisma.product.findMany({
        where: { isNewArrival: true },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      })
    } else if (type === 'sale') {
      products = await prisma.product.findMany({
        where: { isOnSale: true },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    const transformedProducts = products.map((p) => ({
      id: String(p.id),
      name: p.name,
      price: Number(p.price),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
      image: p.thumbnail || '/placeholder.svg?height=300&width=300',
      category: p.category?.name || 'Other',
      rating: Number(p.averageRating),
      reviews: p.reviewCount,
      featured: p.isFeatured,
      sale: p.isOnSale,
      newArrival: p.isNewArrival,
    }))

    return NextResponse.json({
      success: true,
      data: transformedProducts,
    })
  } catch (error) {
    console.error('GET /api/home-products error:', error)
    return NextResponse.json(
      { error: 'Database error', detail: String(error) },
      { status: 500 }
    )
  }
}
