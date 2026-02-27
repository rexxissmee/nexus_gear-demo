export interface Product {
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

// Utility functions for filtering and sorting products
export const filterProducts = (
  products: Product[],
  filters: {
    category?: string
    featured?: boolean
    newArrival?: boolean
    sale?: boolean
    minPrice?: number
    maxPrice?: number
    minRating?: number
  },
): Product[] => {
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false
    if (filters.featured && !product.featured) return false
    if (filters.newArrival && !product.newArrival) return false
    if (filters.sale && !product.sale) return false
    if (filters.minPrice && product.price < filters.minPrice) return false
    if (filters.maxPrice && product.price > filters.maxPrice) return false
    if (filters.minRating && product.rating < filters.minRating) return false
    return true
  })
}

export const sortProducts = (products: Product[], sortBy: string): Product[] => {
  const sorted = [...products]

  switch (sortBy) {
    case "price-low":
      return sorted.sort((a, b) => a.price - b.price)
    case "price-high":
      return sorted.sort((a, b) => b.price - a.price)
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating)
    case "reviews":
      return sorted.sort((a, b) => b.reviews - a.reviews)
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return sorted
  }
}
