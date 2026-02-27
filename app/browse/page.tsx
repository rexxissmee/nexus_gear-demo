"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Search, Filter, Star, X } from "lucide-react"
import ProductCard from "@/components/product-card"
import { filterProducts, sortProducts } from "@/lib/products"
import { useEffect as useClientEffect } from "react"

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("default")
  const [priceRange, setPriceRange] = useState([0, 2000])
  const [minRating, setMinRating] = useState(0)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showFeatured, setShowFeatured] = useState(false)
  const [showNewArrivals, setShowNewArrivals] = useState(false)
  const [showSale, setShowSale] = useState(false)
  const [serverProducts, setServerProducts] = useState<any[]>([])
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const category = searchParams.get("category")
    const featured = searchParams.get("featured")
    const newArrival = searchParams.get("newArrival")
    const sale = searchParams.get("sale")

    if (category) {
      setSelectedCategories([category])
    }
    setShowFeatured(featured === "true")
    setShowNewArrivals(newArrival === "true")
    setShowSale(sale === "true")
  }, [searchParams])

  useClientEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
        ])
        const prodJson = await prodRes.json()
        const catJson = await catRes.json()
        if (prodRes.ok) {
          const mapped = (prodJson.data || []).map((p: any) => ({
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
          setServerProducts(mapped)
        }
        if (catRes.ok) {
          const cats = (catJson.data || [])
            .filter((c: any) => c.status === 'active')
            .sort((a: any, b: any) => a.id - b.id)
            .map((c: any) => c.name)
          setAllCategories(cats)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = serverProducts

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Apply filters
    filtered = filterProducts(filtered, {
      category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
      featured: showFeatured || undefined,
      newArrival: showNewArrivals || undefined,
      sale: showSale || undefined,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      minRating: minRating,
    })

    // Apply category filter for multiple categories
    if (selectedCategories.length > 1) {
      filtered = filtered.filter((product) => selectedCategories.includes(product.category))
    }

    // Apply sorting
    return sortProducts(filtered, sortBy)
  }, [serverProducts, searchTerm, selectedCategories, showFeatured, showNewArrivals, showSale, priceRange, minRating, sortBy])

  // Pagination (12 per page)
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = 12
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedProducts.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const visibleProducts = filteredAndSortedProducts.slice(pageStart, pageStart + pageSize)

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`/browse?${params.toString()}`)
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories((prev) => [...prev, category])
    } else {
      setSelectedCategories((prev) => prev.filter((c) => c !== category))
    }
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setShowFeatured(false)
    setShowNewArrivals(false)
    setShowSale(false)
    setPriceRange([0, 2000])
    setMinRating(0)
    setSearchTerm("")
    setSortBy("default")
  }

  const activeFiltersCount =
    selectedCategories.length +
    (showFeatured ? 1 : 0) +
    (showNewArrivals ? 1 : 0) +
    (showSale ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0)

  const specialFilters = [
    { id: "featured", label: "Featured Products", checked: showFeatured, setter: setShowFeatured },
    { id: "newArrivals", label: "New Arrivals", checked: showNewArrivals, setter: setShowNewArrivals },
    { id: "sale", label: "On Sale", checked: showSale, setter: setShowSale },
  ]

  const handleSpecialFilterChange = (id: string, checked: boolean) => {
    if (id === "featured") setShowFeatured(checked)
    if (id === "newArrivals") setShowNewArrivals(checked)
    if (id === "sale") setShowSale(checked)
  }

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          {allCategories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={category}
                checked={selectedCategories.includes(category)}
                onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
              />
              <label
                htmlFor={category}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {category}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Special Filters */}
      <div>
        <h3 className="font-semibold mb-3">Special</h3>
        <div className="space-y-2">
          {specialFilters.map((filter) => (
            <div key={filter.id} className="flex items-center space-x-2">
              <Checkbox
                id={filter.id}
                checked={filter.checked}
                onCheckedChange={(checked) => handleSpecialFilterChange(filter.id, checked as boolean)}
              />
              <label htmlFor={filter.id} className="text-sm font-medium">
                {filter.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-semibold mb-3">Price Range</h3>
        <div className="px-2">
          <Slider value={priceRange} onValueChange={setPriceRange} max={2000} min={0} step={50} className="w-full" />
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div>
        <h3 className="font-semibold mb-3">Minimum Rating</h3>
        <div className="space-y-2">
          {[4, 3, 2, 1].map((rating) => (
            <div key={rating} className="flex items-center space-x-2">
              <Checkbox
                id={`rating-${rating}`}
                checked={minRating === rating}
                onCheckedChange={(checked) => setMinRating(checked ? rating : 0)}
              />
              <label htmlFor={`rating-${rating}`} className="flex items-center text-sm">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1">& up</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button onClick={clearFilters} variant="outline" className="w-full bg-transparent">
          Clear All Filters ({activeFiltersCount})
        </Button>
      )}
    </div>
  )

  return (
    <div className="container px-4 py-8 mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Browse Products</h1>

        {/* Search and Sort */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="reviews">Most Reviews</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden bg-transparent">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Filter products by category, price, rating and more.</SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedCategories.map((category) => (
              <Badge key={category} variant="secondary" className="flex items-center gap-1">
                {category}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleCategoryChange(category, false)} />
              </Badge>
            ))}
            {showFeatured && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Featured
                <X className="h-3 w-3 cursor-pointer" onClick={() => setShowFeatured(false)} />
              </Badge>
            )}
            {showNewArrivals && (
              <Badge variant="secondary" className="flex items-center gap-1">
                New Arrivals
                <X className="h-3 w-3 cursor-pointer" onClick={() => setShowNewArrivals(false)} />
              </Badge>
            )}
            {showSale && (
              <Badge variant="secondary" className="flex items-center gap-1">
                On Sale
                <X className="h-3 w-3 cursor-pointer" onClick={() => setShowSale(false)} />
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-gray-900 p-6 rounded-lg border">
            <h2 className="font-semibold mb-4">Filters</h2>
            <FilterContent />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          <div className="mb-4 text-sm text-gray-600">
            {isLoading ? 'Loading products...' : `Showing ${visibleProducts.length} of ${filteredAndSortedProducts.length} products (Page ${currentPage}/${totalPages})`}
          </div>

          {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No products found matching your criteria.</p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? (
                <div className="col-span-full text-center py-12">Loading...</div>
              ) : (
                visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              )}
            </div>
          )}
          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="inline-flex items-center gap-1">
                <Button 
                  variant="outline" 
                  className="border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9" 
                  disabled={currentPage <= 1} 
                  onClick={() => goToPage(currentPage - 1)}
                >
                  «
                </Button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, idx) => {
                  const page = idx + 1
                  if (page > totalPages) return null
                  return (
                    <Button 
                      key={page} 
                      variant={page === currentPage ? "default" : "outline"} 
                      className={page === currentPage ? "bg-primary text-white hover:bg-primary/90" : "border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9"} 
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </Button>
                  )
                })}
                {totalPages > 7 && (
                  <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9" disabled>
                    …
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9" 
                  disabled={currentPage >= totalPages} 
                  onClick={() => goToPage(currentPage + 1)}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
