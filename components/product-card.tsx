"use client"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/store/auth-store"
import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, ShoppingCart } from "lucide-react"

interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  category: string
  rating: number
  reviews: number
  featured?: boolean
  sale?: boolean
}

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { toast } = useToast()
  const user = (typeof window !== 'undefined') ? JSON.parse(localStorage.getItem('user') || 'null') : null

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const loggedUser = user
      if (!loggedUser?.id) {
        window.location.href = "/auth"
        return
      }
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', user_id: Number(loggedUser.id), product_id: Number(product.id), quantity: 1 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Add to cart failed')
      toast({ title: 'Added to cart', description: `${product.name} has been added to your cart.`, className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart:refresh'))
      }
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message || 'Unable to add to cart.', variant: 'destructive', className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
    }
  }

  return (
    <div
      className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sale Badge */}
      {product.sale && discount > 0 && (
        <Badge className="absolute top-3 left-3 z-10 bg-red-600 hover:bg-red-700">-{discount}%</Badge>
      )}

      {/* Featured Badge */}
      {product.featured && (
        <Badge className="absolute top-3 right-3 z-10 bg-blue-600 hover:bg-blue-700">Featured</Badge>
      )}

      {/* Product Image - Click to view product */}
      <Link href={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer">
          <Image
            src={product.image || "/placeholder.svg?height=300&width=300"}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Add to Cart overlay - appears on hover */}
          <div
            className={`absolute inset-0 bg-black/60 ${
              isHovered ? "opacity-100" : "opacity-0"
            } transition-opacity duration-300 flex items-center justify-center`}
          >
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white transform transition-transform duration-200 hover:scale-105"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-4 flex flex-col h-[180px]">
        <div className="flex-1">
          <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">{product.category}</p>
          <Link href={`/product/${product.id}`} className="group">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[2.5rem]">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Rating */}
        <div className="flex items-center mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 ml-2">
            {product.rating} ({product.reviews})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="text-sm text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-3 w-3" />
            <span className="sr-only">Add to cart</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
