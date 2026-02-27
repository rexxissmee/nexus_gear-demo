'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { LayoutDashboard, Package, ShoppingCart, Users, Search, Bell, Menu, LogOut, Settings, User, Tags, UserRound, ArrowLeftFromLine } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Categories',
    href: '/admin/categories',
    icon: Tags,
  },
  {
    name: 'Products',
    href: '/admin/products',
    icon: Package,
  },
  {
    name: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const logout = useAuthStore((s) => s.logout)

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex h-full flex-col bg-white ${mobile ? 'w-full' : sidebarCollapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex h-16 items-center justify-center border-b border-blue-200 px-4">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            {!mobile && !sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800">
                <span className="gradient-text-light">NexusAdmin</span>
              </h1>
            )}
            {!mobile && sidebarCollapsed && (
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/images/nexus-logo.png" alt="Nexus" className="w-6 h-6" />
              </div>
            )}
            {mobile && (
              <h1 className="text-xl font-bold text-gray-800">
                <span className="gradient-text-light">NexusAdmin</span>
              </h1>
            )}
          </Link>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                }`}
              title={item.name}
            >
              <Icon className={`h-5 w-5 ${!mobile && sidebarCollapsed ? 'mx-auto' : 'mr-3'}`} />
              {(!mobile && !sidebarCollapsed) || mobile ? item.name : null}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4">
        <Link
          href="/"
          className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 text-gray-700 hover:bg-blue-100 hover:text-blue-700 ${sidebarCollapsed ? 'justify-center' : ''}`}
          title="Back to homepage"
        >
          <ArrowLeftFromLine className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
          {!sidebarCollapsed && 'Back to homepage'}
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#eff6ff]">
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-56'}`}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-56">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(v => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search anything..."
                className="w-80 pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-slate-600" />
              <Badge className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 h-5 w-5 rounded-full p-0 text-xs bg-red-500 hover:bg-red-600 flex items-center justify-center">
                3
              </Badge>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <UserRound className="h-5 w-5 text-slate-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Administrator</p>
                    <p className="text-xs text-slate-500">admin@nexusgear.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => { logout(); if (typeof window !== 'undefined') { localStorage.removeItem('user'); window.location.href = '/auth'; } }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#eff6ff] p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
