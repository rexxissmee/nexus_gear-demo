"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

export default function CartPage() {
  const { toast } = useToast()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const user = (typeof window !== 'undefined') ? JSON.parse(localStorage.getItem('user') || 'null') : null

  const fetchCart = async () => {
    try {
      if (!user?.id) {
        setCartItems([])
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await fetch(`/api/cart?user_id=${encodeURIComponent(user.id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Load cart failed')
      setCartItems(data.data || [])
    } catch (e: any) {
      toast({ title: 'Load Failed', description: e?.message || 'Unable to load cart.', variant: 'destructive', className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCart()
    const handler = () => fetchCart()
    if (typeof window !== 'undefined') {
      window.addEventListener('cart:refresh', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cart:refresh', handler as EventListener)
      }
    }
  }, [])

  const updateQuantity = async (cart_item_id: number, newQuantity: number) => {
    try {
      if (!user?.id) return
      if (newQuantity < 1) return
      const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', user_id: Number(user.id), cart_item_id, quantity: newQuantity }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Update failed')
      setCartItems(prev => prev.map(it => it.cart_item_id === cart_item_id ? { ...it, quantity: newQuantity } : it))
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart:refresh'))
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message || 'Unable to update cart.', variant: 'destructive', className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
    }
  }

  const removeItem = async (cart_item_id: number) => {
    try {
      if (!user?.id) return
      const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', user_id: Number(user.id), cart_item_id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Remove failed')
      setCartItems(prev => prev.filter(it => it.cart_item_id !== cart_item_id))
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart:refresh'))
      toast({ title: 'Removed', description: 'Item removed from cart.', className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message || 'Unable to remove item.', variant: 'destructive', className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
    }
  }

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems])
  const shipping = 15
  const total = subtotal + shipping

  if (!loading && cartItems.length === 0) {
    return (
      <main className="flex-1 container px-4 py-16 mx-auto">
        <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold mb-4">Your cart is empty</h2>
          <p className="text-gray-400 mb-8">Looks like you haven't added any items to your cart yet.</p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/">Continue Shopping</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 container px-4 py-8 lg:py-16 mx-auto max-w-7xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-6 lg:mb-8">Your Cart</h1>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 lg:p-6 border border-gray-200 shadow-sm">
            {/* Desktop Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 mb-4 text-sm font-medium text-gray-600 border-b border-gray-200 pb-3">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-center">Price</div>
              <div className="col-span-2 text-center">Quantity</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500">Loading cart...</div>
            ) : cartItems.map((item, index) => (
              <div key={item.cart_item_id ?? item.id} className="py-4 lg:py-6">
                {/* Mobile Layout */}
                <div className="lg:hidden space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                      <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                      <p className="text-lg font-semibold text-blue-600 mt-1">${item.price.toFixed(2)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => removeItem(item.cart_item_id ?? item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-gray-300 rounded-md">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none rounded-l-md hover:bg-gray-100"
                        onClick={() => updateQuantity(item.cart_item_id ?? item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                        <span className="sr-only">Decrease quantity</span>
                      </Button>
                      <div className="h-8 w-12 flex items-center justify-center text-sm font-medium bg-gray-50">
                        {item.quantity}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none rounded-r-md hover:bg-gray-100"
                        onClick={() => updateQuantity(item.cart_item_id ?? item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                        <span className="sr-only">Increase quantity</span>
                      </Button>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-6 flex items-center space-x-4">
                    <div className="relative h-20 w-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className="text-lg font-semibold text-blue-600">${item.price.toFixed(2)}</span>
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <div className="flex items-center border border-gray-300 rounded-md">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none rounded-l-md hover:bg-gray-100"
                        onClick={() => updateQuantity(item.cart_item_id ?? item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                        <span className="sr-only">Decrease quantity</span>
                      </Button>
                      <div className="h-8 w-12 flex items-center justify-center text-sm font-medium bg-gray-50">
                        {item.quantity}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none rounded-r-md hover:bg-gray-100"
                        onClick={() => updateQuantity(item.cart_item_id ?? item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                        <span className="sr-only">Increase quantity</span>
                      </Button>
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="flex items-center justify-end space-x-4">
                      <span className="text-lg font-semibold text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                        onClick={() => removeItem(item.cart_item_id ?? item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove item</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {index < cartItems.length - 1 && <Separator className="mt-4 lg:mt-6 bg-gray-200" />}
              </div>
            ))}

            <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6 lg:mt-8 pt-6 border-t border-gray-200">
              <Button variant="outline" asChild className="order-2 sm:order-1">
                <Link href="/">Continue Shopping</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    if (!user?.id) return
                    const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear', user_id: Number(user.id) }) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Clear failed')
                    setCartItems([])
                    toast({ title: 'Cleared', description: 'Your cart has been cleared.', className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
                    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart:refresh'))
                  } catch (e: any) {
                    toast({ title: 'Failed', description: e?.message || 'Unable to clear cart.', variant: 'destructive', className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4' })
                  }
                }}
                className="order-1 sm:order-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                Clear Cart
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 lg:p-6 border border-gray-200 shadow-sm sticky top-24">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">${shipping.toFixed(2)}</span>
              </div>
              <Separator className="my-3 bg-gray-200" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
            </div>

            <Link href="/checkout" passHref legacyBehavior>
              <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white">Proceed to Checkout</Button>
            </Link>

            <div className="mt-6 text-xs text-gray-500 text-center">
              <p className="mb-2">We accept the following payment methods</p>
              <div className="flex justify-center space-x-2">
                <img src="/images/visa.svg" alt="Visa" className="w-8 h-5 rounded shadow" />
                <img src="/images/mastercard.svg" alt="Mastercard" className="w-8 h-5 rounded shadow" />
                <img src="/images/jcb.svg" alt="JCB" className="w-8 h-5 rounded shadow" />
                <img src="/images/napas.svg" alt="Napas" className="w-8 h-5 rounded shadow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
