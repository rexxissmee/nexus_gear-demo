import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, ShoppingCart, Trash2, Star } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function WishlistPage() {
  const wishlistItems = [
    {
      id: "1",
      name: "NexusKey Pro Mechanical Keyboard",
      price: 149.99,
      originalPrice: 199.99,
      image: "/placeholder.svg?height=200&width=200",
      category: "Keyboards",
      rating: 4.8,
      reviews: 324,
      inStock: true,
      sale: true,
    },
    {
      id: "5",
      name: "NexusKey Compact 60% Keyboard",
      price: 99.99,
      image: "/placeholder.svg?height=200&width=200",
      category: "Keyboards",
      rating: 4.4,
      reviews: 98,
      inStock: true,
      sale: false,
    },
    {
      id: "6",
      name: "VelocityMouse Wireless",
      price: 89.99,
      originalPrice: 109.99,
      image: "/placeholder.svg?height=200&width=200",
      category: "Mice",
      rating: 4.5,
      reviews: 167,
      inStock: false,
      sale: true,
    },
    {
      id: "7",
      name: "SoundWave Lite Gaming Headset",
      price: 69.99,
      image: "/placeholder.svg?height=200&width=200",
      category: "Headsets",
      rating: 4.3,
      reviews: 203,
      inStock: true,
      sale: false,
    },
    {
      id: "8",
      name: "RGB Keycap Set - Cosmic",
      price: 39.99,
      image: "/placeholder.svg?height=200&width=200",
      category: "Accessories",
      rating: 4.6,
      reviews: 87,
      inStock: true,
      sale: false,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wishlist</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{wishlistItems.length} items saved for later</p>
        </div>
        <Button variant="outline" className="text-red-600 hover:text-red-700 bg-transparent">
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All
        </Button>
      </div>

      {wishlistItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Heart className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Your wishlist is empty</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Start adding items you love to your wishlist</p>
            <Link href="/">
              <Button className="gradient-btn-light dark:gradient-btn-dark text-white">Continue Shopping</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistItems.map((item) => {
            const discount = item.originalPrice
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0

            return (
              <Card
                key={item.id}
                className="group relative overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                {/* Sale Badge */}
                {item.sale && discount > 0 && (
                  <Badge className="absolute top-3 left-3 z-10 bg-red-600 hover:bg-red-700">-{discount}%</Badge>
                )}

                {/* Remove from Wishlist */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 z-10 h-8 w-8 bg-white/80 hover:bg-white text-red-500 hover:text-red-600"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  <span className="sr-only">Remove from wishlist</span>
                </Button>

                {/* Product Image */}
                <Link href={`/product/${item.id}`}>
                  <div className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {!item.inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="secondary" className="bg-gray-800 text-white">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product Info */}
                <CardContent className="p-4">
                  <div className="mb-2">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">{item.category}</p>
                    <Link href={`/product/${item.id}`} className="group">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                        {item.name}
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
                            i < Math.floor(item.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {item.rating} ({item.reviews})
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">${item.price.toFixed(2)}</span>
                      {item.originalPrice && (
                        <span className="text-sm text-gray-500 line-through">${item.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={!item.inStock}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {item.inStock ? "Add to Cart" : "Out of Stock"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 bg-transparent"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
