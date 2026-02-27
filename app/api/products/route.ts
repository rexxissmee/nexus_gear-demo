import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/products - Get all products or single product by id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')

    // Get single product with images
    if (id > 0) {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: {
            select: { name: true },
          },
          images: {
            select: { id: true, imageUrl: true },
            orderBy: { id: 'asc' },
          },
        },
      })

      if (!product) {
        return NextResponse.json({ error: ['Product not found.'] }, { status: 404 })
      }

      const productData = {
        ...product,
        category_name: product.category?.name || null,
        category: undefined, // Remove nested object
      }

      return NextResponse.json({
        success: true,
        data: {
          product: productData,
          images: product.images.map(img => ({
            id: img.id,
            image_url: img.imageUrl,
          })),
        },
      })
    }

    // Get all products
    const products = await prisma.product.findMany({
      orderBy: { id: 'desc' },
      include: {
        category: {
          select: { name: true },
        },
      },
    })

    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      original_price: p.originalPrice,
      thumbnail: p.thumbnail,
      stock: p.stock,
      is_featured: p.isFeatured,
      is_on_sale: p.isOnSale,
      is_new_arrival: p.isNewArrival,
      average_rating: p.averageRating,
      review_count: p.reviewCount,
      category_name: p.category?.name || null,
    }))

    return NextResponse.json({
      success: true,
      data: formattedProducts,
    })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create or update product
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const action = formData.get('action') as string
    const id = formData.get('id') ? parseInt(formData.get('id') as string) : null
    
    // Handle DELETE action
    if (action === 'delete' && id) {
      await prisma.product.delete({ where: { id } })
      return NextResponse.json({
        success: true,
        message: 'Product deleted successfully.',
      })
    }
    
    // Extract form data
    const data: any = {}
    formData.forEach((value, key) => { 
      if (value instanceof File) {
        data[key] = value
      } else {
        data[key] = value 
      }
    })
    
    // Validation
    const errors: string[] = []
    if (!data.name?.trim()) errors.push('Product name is required.')
    if (!data.price || parseFloat(data.price) <= 0) errors.push('Valid price is required.')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    // Handle thumbnail file upload (field name: 'thumbnail')
    let thumbnailPath: string | undefined = undefined
    const thumbnailFile = data.thumbnail
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      const { saveUploadedFile } = await import('@/lib/upload')
      const result = await saveUploadedFile(thumbnailFile, 'product-images')
      if (result.success) {
        thumbnailPath = result.path
      } else {
        return NextResponse.json({ error: result.errors }, { status: 400 })
      }
    }

    const productData: any = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price: parseFloat(data.price),
      originalPrice: data.original_price ? parseFloat(data.original_price) : null,
      stock: parseInt(data.stock) || 0,
      categoryId: data.category_id ? parseInt(data.category_id) : null,
      averageRating: data.average_rating ? parseFloat(data.average_rating) : 0,
      reviewCount: parseInt(data.review_count) || 0,
      isFeatured: Boolean(data.is_featured === 'true' || data.is_featured === '1' || data.is_featured === true),
      isOnSale: Boolean(data.is_on_sale === 'true' || data.is_on_sale === '1' || data.is_on_sale === true),
      isNewArrival: Boolean(data.is_new_arrival === 'true' || data.is_new_arrival === '1' || data.is_new_arrival === true),
    }
    
    // Only update thumbnail if a new file was uploaded
    if (thumbnailPath) {
      productData.thumbnail = thumbnailPath
    }

    if (id) {
      // UPDATE existing product
      await prisma.product.update({
        where: { id },
        data: productData,
      })

      return NextResponse.json({
        success: true,
        message: 'Product updated successfully.',
      })
    } else {
      // CREATE new product
      const product = await prisma.product.create({
        data: productData,
      })

      return NextResponse.json(
        {
          success: true,
          message: 'Product created successfully.',
          data: product,
        },
        { status: 201 }
      )
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: ['Product not found.'] }, { status: 404 })
      }
    }
    console.error('POST /api/products error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT /api/products - Update product
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const id = parseInt(data.id) || 0

    if (id <= 0) {
      return NextResponse.json({ error: ['Valid product id is required.'] }, { status: 400 })
    }

    // Build update data
    const updateData: Prisma.ProductUpdateInput = {}
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.price !== undefined) updateData.price = parseFloat(data.price)
    if (data.original_price !== undefined) updateData.originalPrice = data.original_price ? parseFloat(data.original_price) : null
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail?.trim() || null
    if (data.stock !== undefined) updateData.stock = parseInt(data.stock)
    if (data.category_id !== undefined) {
      const catId = data.category_id ? parseInt(data.category_id) : null
      updateData.category = catId ? { connect: { id: catId } } : { disconnect: true }
    }
    if (data.is_featured !== undefined) updateData.isFeatured = Boolean(data.is_featured)
    if (data.is_on_sale !== undefined) updateData.isOnSale = Boolean(data.is_on_sale)
    if (data.is_new_arrival !== undefined) updateData.isNewArrival = Boolean(data.is_new_arrival)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: ['No fields to update.'] }, { status: 400 })
    }

    // Update product
    await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'Product updated successfully.',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: ['Product not found.'] }, { status: 404 })
    }

    console.error('PUT /api/products error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const PATCH = PUT

// DELETE /api/products - Delete product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let id = parseInt(searchParams.get('id') || '0')

    if (id <= 0) {
      const data = await request.json().catch(() => ({}))
      id = parseInt(data.id) || 0
    }

    if (id <= 0) {
      return NextResponse.json({ error: ['Valid product id is required.'] }, { status: 400 })
    }

    // Delete product (images will cascade delete due to schema)
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully.',
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: ['Product not found.'] }, { status: 404 })
    }

    console.error('DELETE /api/products error:', error)
    return NextResponse.json(
      { error: ['Database error.'], detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
