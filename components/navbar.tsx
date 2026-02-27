"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import ScrollableLink from "@/components/scrollable-link"
import ThemeToggle from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, ChevronRight, ChevronDown, ShoppingCart, User, Heart, Search } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

export default function Navbar() {
  const [isProductsOpen, setIsProductsOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [productCategories, setProductCategories] = useState<Array<{title: string, href: string, description: string}>>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const { user, logout } = useAuthStore()
  const [cartCount, setCartCount] = useState<number>(0)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user")
      if (userStr) {
        try {
          JSON.parse(userStr)
        } catch { }
      }
    }
  }, [])

  useEffect(() => {
    const fetchCartCount = async () => {
      try {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
        const user = userStr ? JSON.parse(userStr) : null
        if (!user?.id) { setCartCount(0); return }
        const res = await fetch(`/api/cart?user_id=${encodeURIComponent(user.id)}`)
        const data = await res.json()
        if (res.ok) setCartCount((data.data || []).reduce((sum: number, it: any) => sum + (it.quantity || 0), 0))
        else setCartCount(0)
      } catch {
        setCartCount(0)
      }
    }
    fetchCartCount()

    const handler = () => fetchCartCount()
    if (typeof window !== 'undefined') {
      window.addEventListener('cart:refresh', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cart:refresh', handler as EventListener)
      }
    }
  }, [])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const response = await fetch('/api/categories')
        const data = await response.json()
        
        if (response.ok && data.data) {
          const activeCategories = data.data
            .filter((cat: any) => cat.status === 'active')
            .sort((a: any, b: any) => a.id - b.id)
            .map((cat: any) => ({
              title: cat.name,
              href: `/browse?category=${encodeURIComponent(cat.name)}`,
              description: cat.description || `Explore our ${cat.name} collection.`,
            }))
          setProductCategories(activeCategories)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        // Fallback to default categories if API fails
        setProductCategories([
          {
            title: "PC Handheld",
            href: "/browse?category=PC%20Handheld",
            description: "Portable gaming PCs and handheld gaming devices for gaming on the go.",
          },
          {
            title: "Controller",
            href: "/browse?category=Controller",
            description: "Wireless controllers, racing wheels, and arcade fight sticks.",
          },
          {
            title: "Gaming Mouse",
            href: "/browse?category=Gaming%20Mouse",
            description: "High-precision gaming mice with customizable DPI and RGB lighting.",
          },
          {
            title: "Accessories",
            href: "/browse?category=Accessories",
            description: "Gaming mousepads, stands, LED strips, and other gaming essentials.",
          },
        ])
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  const specialCategories = [
    {
      title: "Featured Products",
      href: "/browse?featured=true",
      description: "Our top-rated and most popular gaming products.",
    },
    {
      title: "New Arrivals",
      href: "/browse?newArrival=true",
      description: "Latest gaming gear and newest product releases.",
    },
    {
      title: "On Sale",
      href: "/browse?sale=true",
      description: "Discounted products and special offers.",
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 w-full max-w-screen-2xl mx-auto">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <div className="flex flex-col gap-6">
              <ScrollableLink href="/" className="flex items-center gap-2 font-bold text-xl mb-2">
                <span className="gradient-text-light dark:gradient-text-dark">NexusGear</span>
              </ScrollableLink>

              <div className="space-y-1">
                <ScrollableLink href="/" className="block py-2 px-3 rounded-md hover:bg-accent">
                  Home
                </ScrollableLink>

                <div>
                  <button
                    onClick={() => setIsProductsOpen(!isProductsOpen)}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent font-medium"
                  >
                    Products
                    {isProductsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isProductsOpen && (
                    <div className="pl-2 mt-1 space-y-1 text-sm">
                      {productCategories.map((category) => (
                        <ScrollableLink
                          key={category.title}
                          href={category.href}
                          className="block py-1 px-2 rounded-md hover:bg-accent"
                        >
                          {category.title}
                        </ScrollableLink>
                      ))}
                      <div className="border-t pt-1 mt-2">
                        {specialCategories.map((category) => (
                          <ScrollableLink
                            key={category.title}
                            href={category.href}
                            className="block py-1 px-2 rounded-md hover:bg-accent"
                          >
                            {category.title}
                          </ScrollableLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <ScrollableLink href="/about" className="block py-2 px-3 rounded-md hover:bg-accent">
                  About
                </ScrollableLink>
                <ScrollableLink href="/contact" className="block py-2 px-3 rounded-md hover:bg-accent">
                  Contact
                </ScrollableLink>
                <ScrollableLink href="/policy" className="block py-2 px-3 rounded-md hover:bg-accent">
                  Policies
                </ScrollableLink>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <ScrollableLink href="/" className="mx-6 flex items-center gap-2 font-bold text-2xl md:text-3xl">
          <span className="gradient-text-light dark:gradient-text-dark">NexusGear</span>
        </ScrollableLink>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger
                className="cursor-pointer select-none rounded-md px-3 py-2 font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onClick={() => window.location.href = '/browse'}
              >
                Products
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[600px] gap-3 p-6 md:w-[700px] lg:w-[800px]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium leading-none mb-3 text-gray-900 dark:text-white">
                        Product Categories
                      </h4>
                      <ul className="space-y-2">
                        {productCategories.map((item) => (
                          <li key={item.title}>
                            <ScrollableLink
                              href={item.href}
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            >
                              <div className="text-sm font-medium leading-none">{item.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            </ScrollableLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium leading-none mb-3 text-gray-900 dark:text-white">
                        Special Collections
                      </h4>
                      <ul className="space-y-2">
                        {specialCategories.map((item) => (
                          <li key={item.title}>
                            <ScrollableLink
                              href={item.href}
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            >
                              <div className="text-sm font-medium leading-none">{item.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            </ScrollableLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden md:flex items-center space-x-6 ml-6">
          <ScrollableLink href="/about" className="text-sm font-medium hover:text-blue-600 transition-colors">
            About
          </ScrollableLink>
          <ScrollableLink href="/contact" className="text-sm font-medium hover:text-blue-600 transition-colors">
            Contact
          </ScrollableLink>
          <ScrollableLink href="/policy" className="text-sm font-medium hover:text-blue-600 transition-colors">
            Policies
          </ScrollableLink>
        </div>

        <div className="ml-auto flex items-center space-x-2 md:space-x-4">
          <ThemeToggle />
          <ScrollableLink href="/cart">
            <Button
              variant="outline"
              size="icon"
              className="relative border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-xs text-white flex items-center justify-center">
                  {cartCount}
                </span>
              )}
              <span className="sr-only">Shopping cart</span>
            </Button>
          </ScrollableLink>
          {user ? (
            <ScrollableLink href="/profile">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 bg-transparent h-9 w-9"
              >
                <User className="h-4 w-4" />
                <span className="sr-only">User profile</span>
              </Button>
            </ScrollableLink>
          ) : (
            <ScrollableLink href="/auth">
              <Button className="gradient-btn-light dark:gradient-btn-dark text-white text-sm px-3 py-2 h-9">
                Login
              </Button>
            </ScrollableLink>
          )}
        </div>
      </div>
    </header>
  )
}
