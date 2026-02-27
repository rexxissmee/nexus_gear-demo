'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, ChevronRight } from "lucide-react"
import ProductCard from "@/components/product-card"
import CountdownTimer from "@/components/countdown-timer"

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
  newArrival?: boolean
}

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const categoryLinks = [
    { name: "PC Handheld", href: "/browse?category=PC%20Handheld" },
    { name: "Controller", href: "/browse?category=Controller" },
    { name: "Gaming Mouse", href: "/browse?category=Gaming%20Mouse" },
    { name: "Accessories", href: "/browse?category=Accessories" },
  ]

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        
        // Fetch featured products
        const featuredRes = await fetch('/api/home-products?type=featured')
        const featuredData = await featuredRes.json()
        if (featuredRes.ok) {
          setFeaturedProducts(featuredData.data.slice(0, 4))
        }
        
        // Fetch new arrivals
        const newArrivalsRes = await fetch('/api/home-products?type=new_arrivals')
        const newArrivalsData = await newArrivalsRes.json()
        if (newArrivalsRes.ok) {
          setNewArrivals(newArrivalsData.data.slice(0, 4))
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative">
        <div className="container px-4 py-8 md:py-16 lg:py-20 mx-auto flex items-center justify-center min-h-[320px]">
          <div className="absolute inset-0 bg-[url('/images/new-collection.jpg')] opacity-50 bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50" />
          <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center justify-center w-full">
            <Badge className="mb-4 bg-blue-600 hover:bg-blue-700 text-white">New Collection</Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 md:mb-6 text-blue-600 drop-shadow-[0_4px_24px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              Level Up Your Gaming Experience
            </h1>
            <p className="text-base md:text-lg lg:text-xl hero-subtext mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed text-gray-900 dark:text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              Professional gaming gear designed for performance, comfort, and victory
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/browse">
                <Button size="lg" className="gradient-btn-light dark:gradient-btn-dark text-white">
                  Shop Now
                </Button>
              </Link>
              <Link href="/browse?featured=true">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10 bg-transparent"
                >
                  View Collections
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Categories */}
      <section className="container px-4 py-12 mx-auto">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Find Your Gear</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-10" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categoryLinks.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="group relative overflow-hidden rounded-lg bg-white shadow-md h-40 flex items-center justify-center border border-blue-100 hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-blue-100/50 group-hover:opacity-80 transition-opacity" />
              <h3 className="relative z-10 text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {category.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Summer Sale Banner - Simplified */}
      <section className="container px-4 py-12 mx-auto">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-800">
          <div className="absolute inset-0 bg-[url('/placeholder.svg?height=400&width=1200')] mix-blend-overlay opacity-20" />
          <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left mb-6 md:mb-0 md:mr-8 w-full">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Summer Sale</h2>
              <p className="text-blue-100 mb-6">Get up to 40% off on selected gaming peripherals</p>
              <div className="flex justify-center md:block w-full">
                <CountdownTimer />
              </div>
              <Link href="/browse?sale=true">
                <Button className="bg-white text-blue-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 mt-6">
                  Shop Now
                </Button>
              </Link>
            </div>
            <div className="w-full md:w-1/3 flex justify-center">
              <div className="bg-blue-700/50 backdrop-blur-sm rounded-full p-6">
                <div className="text-center text-white">
                  <span className="block text-5xl font-bold">40%</span>
                  <span className="block text-xl">OFF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container px-4 py-12 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          <Link href="/browse?featured=true" className="text-blue-600 hover:text-blue-700 flex items-center">
            View all <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <div className="text-gray-500">Loading featured products...</div>
            </div>
          ) : featuredProducts.length > 0 ? (
            featuredProducts.map(product => (
              <div key={product.id} className="relative">
                {product.sale && product.originalPrice && (
                  <Badge className="absolute top-3 left-3 bg-red-600 hover:bg-red-700">-{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%</Badge>
                )}
                {product.featured && (
                  <Badge className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700">Featured</Badge>
                )}
                <ProductCard product={product} />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <div className="text-gray-500">No featured products available</div>
            </div>
          )}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="container px-4 py-12 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">New Arrivals</h2>
          <Link href="/browse?newArrival=true" className="text-blue-600 hover:text-blue-700 flex items-center">
            View all <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <div className="text-gray-500">Loading new arrivals...</div>
            </div>
          ) : newArrivals.length > 0 ? (
            newArrivals.map(product => (
              <div key={product.id} className="relative">
                {product.sale && product.originalPrice && (
                  <Badge className="absolute top-3 left-3 bg-red-600 hover:bg-red-700">-{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%</Badge>
                )}
                {product.featured && (
                  <Badge className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700">Featured</Badge>
                )}
                <ProductCard product={product} />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <div className="text-gray-500">No new arrivals available</div>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="container px-4 py-16 mx-auto">
        <div className="bg-blue-50 rounded-xl p-8 md:p-12 text-center max-w-3xl mx-auto border border-blue-100">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900">Join Our Newsletter</h2>
          <p className="text-gray-600 mb-6">Get the latest news and special offers</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input placeholder="Your email address" className="flex-grow" />
            <Button className="gradient-btn-light dark:gradient-btn-dark text-white">Subscribe</Button>
          </div>
        </div>
      </section>
    </main>
  )
}
