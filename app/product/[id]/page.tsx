import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, ShoppingCart, Heart, Share2, Minus, Plus } from "lucide-react"
import ProductCard from "@/components/product-card"
import { notFound } from "next/navigation"
import { headers } from "next/headers"

interface ProductPageProps {
  params: { id: string }
}

async function getBaseUrlFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

async function fetchProductFromApi(id: string) {
  const base = await getBaseUrlFromHeaders()
  const res = await fetch(`${base}/api/products?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  const p = json?.data?.product
  if (!p) return null
  const imgs = json?.data?.images || []
  return {
    id: String(p.id),
    name: p.name as string,
    price: Number(p.price),
    originalPrice: p.original_price !== null ? Number(p.original_price) : undefined,
    image: p.thumbnail || "/placeholder.svg?height=600&width=600",
    category: p.category_name || 'Other',
    rating: p.average_rating ? Number(p.average_rating) : 0,
    reviews: p.review_count ? Number(p.review_count) : 0,
    featured: Boolean(p.is_featured),
    sale: Boolean(p.is_on_sale),
    newArrival: Boolean(p.is_new_arrival),
    images: Array.isArray(imgs) && imgs.length ? imgs.map((i: any) => i.image_url) : [],
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  const product: any = await fetchProductFromApi(id)

  if (!product) {
    notFound()
  }

  // Ensure we get at least 4 related products
  let relatedProducts: any[] = []
  try {
    const base = await getBaseUrlFromHeaders()
    const res = await fetch(`${base}/api/products`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const mapped = (json.data || []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price),
        originalPrice: p.original_price !== null ? Number(p.original_price) : undefined,
        image: p.thumbnail || "/placeholder.svg?height=300&width=300",
        category: p.category_name || 'Other',
        rating: p.average_rating ? Number(p.average_rating) : 0,
        reviews: p.review_count ? Number(p.review_count) : 0,
        featured: Boolean(p.is_featured),
        sale: Boolean(p.is_on_sale),
        newArrival: Boolean(p.is_new_arrival),
      }))
      relatedProducts = mapped.filter((p: any) => p.category === product.category && p.id !== product.id).slice(0, 4)
      if (relatedProducts.length < 4) {
        const additional = mapped
          .filter((p: any) => p.id !== product.id && !relatedProducts.some((rp) => rp.id === p.id))
          .slice(0, 4 - relatedProducts.length)
        relatedProducts = [...relatedProducts, ...additional]
      }
    }
  } catch (e) {}

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  return (
    <main className="flex-1">
      {/* Breadcrumb */}
      <section className="container px-4 py-6 mx-auto">
        <nav className="flex items-center space-x-2 text-sm text-gray-600">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <span>/</span>
          <Link href="#" className="hover:text-blue-600">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>
      </section>

      {/* Product Details */}
      <section className="container px-4 py-8 mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <Image
                src={product.image || "/placeholder.svg?height=600&width=600"}
                alt={product.name}
                fill
                className="object-cover"
              />
              {product.sale && discount > 0 && (
                <Badge className="absolute top-4 left-4 bg-red-600 hover:bg-red-700">-{discount}%</Badge>
              )}
              {product.featured && (
                <Badge className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700">Featured</Badge>
              )}
            </div>

            {/* Thumbnail images */}
            <div className="grid grid-cols-4 gap-2">
              {(product.images && product.images.length ? product.images : [
                "/placeholder.svg?height=150&width=150",
                "/placeholder.svg?height=150&width=150",
                "/placeholder.svg?height=150&width=150",
                "/placeholder.svg?height=150&width=150",
              ]).slice(0, 4).map((img: string, i: number) => (
                <div
                  key={i}
                  className="aspect-square bg-gray-50 rounded-md overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-300"
                >
                  <Image
                    src={img || `/placeholder.svg?height=150&width=150`}
                    alt={`${product.name} view ${i + 1}`}
                    width={150}
                    height={150}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-blue-600 uppercase tracking-wide font-medium mb-2">{product.category}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 ml-2">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-3 mb-6">
                <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <span className="text-xl text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
                )}
                {discount > 0 && <Badge className="bg-green-100 text-green-800">Save {discount}%</Badge>}
              </div>
            </div>

            {/* Product Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Quantity</label>
                <div className="flex items-center border border-gray-300 rounded-md w-32">
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">1</div>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Color</label>
                <div className="flex space-x-2">
                  {["Black", "White", "Blue"].map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-blue-500"
                      style={{ backgroundColor: color.toLowerCase() }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Link href="/auth">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
              </Link>

              <div className="flex space-x-4">
                <Button variant="outline" size="lg" className="flex-1">
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
                <Button variant="outline" size="lg" className="flex-1">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>

            {/* Product Features */}
            <div className="border-t pt-6">
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Free shipping on orders over $100</li>
                <li>✓ 30-day return policy</li>
                <li>✓ 2-year warranty included</li>
                <li>✓ Expert customer support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Product Details Tabs */}
      <section className="container px-4 py-12 mx-auto">
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-6">
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold mb-4">Product Description</h3>
              <p className="text-gray-600 mb-4">
                Experience the ultimate gaming performance with the {product.name}. Designed for serious gamers who
                demand precision, comfort, and reliability.
              </p>
              <p className="text-gray-600 mb-4">
                This premium gaming peripheral features advanced technology and ergonomic design to give you the
                competitive edge you need. Whether you're in intense gaming sessions or professional esports
                competitions, this product delivers consistent performance.
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-1">
                <li>High-quality materials for durability</li>
                <li>Ergonomic design for comfort</li>
                <li>Advanced technology for precision</li>
                <li>Compatible with all major gaming platforms</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="specifications" className="mt-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Technical Specifications</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Brand:</dt>
                    <dd className="font-medium">NexusGear</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Model:</dt>
                    <dd className="font-medium">{product.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Category:</dt>
                    <dd className="font-medium">{product.category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Warranty:</dt>
                    <dd className="font-medium">2 Years</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Package Contents</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• {product.name}</li>
                  <li>• USB Cable</li>
                  <li>• User Manual</li>
                  <li>• Warranty Card</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Customer Reviews</h3>
                <Button variant="outline">Write a Review</Button>
              </div>

              <div className="space-y-4">
                {[
                  {
                    id: 1,
                    name: "John Doe",
                    avatar: "/placeholder.svg?height=40&width=40",
                    rating: 5,
                    date: "2 days ago",
                    comment:
                      "Great product! Excellent build quality and performance. Highly recommended for serious gamers.",
                    verified: true,
                  },
                  {
                    id: 2,
                    name: "Sarah Chen",
                    avatar: "/placeholder.svg?height=40&width=40",
                    rating: 5,
                    date: "1 week ago",
                    comment:
                      "Amazing gaming experience! The precision and responsiveness are outstanding. Worth every penny.",
                    verified: true,
                  },
                  {
                    id: 3,
                    name: "Mike Johnson",
                    avatar: "/placeholder.svg?height=40&width=40",
                    rating: 4,
                    date: "2 weeks ago",
                    comment: "Very good product overall. Great value for money and excellent customer service.",
                    verified: false,
                  },
                ].map((review) => (
                  <div key={review.id} className="border-b pb-4">
                    <div className="flex items-start space-x-4">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={review.avatar || "/placeholder.svg"}
                          alt={review.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, j) => (
                              <Star
                                key={j}
                                className={`h-4 w-4 ${
                                  j < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="ml-2 font-medium">{review.name}</span>
                          {review.verified && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Verified Purchase
                            </Badge>
                          )}
                          <span className="ml-2 text-sm text-gray-500">{review.date}</span>
                        </div>
                        <p className="text-gray-600">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Related Products */}
      <section className="container px-4 py-12 mx-auto">
        <h2 className="text-2xl font-bold mb-8">Related Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((relatedProduct) => (
            <ProductCard key={relatedProduct.id} product={relatedProduct} />
          ))}
        </div>
      </section>
    </main>
  )
}
