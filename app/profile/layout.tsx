"use client"
import { useState } from "react"
import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, Package, User, Edit, MapPin, Heart, LogOut, Menu } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import { useToast } from "@/hooks/use-toast"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/profile",
    icon: LayoutDashboard,
  },
  {
    title: "Orders",
    href: "/profile/orders",
    icon: Package,
  },
  {
    title: "Profile",
    href: "/profile/info",
    icon: User,
  },
  {
    title: "Edit Profile",
    href: "/profile/edit",
    icon: Edit,
  },
  {
    title: "Saved Address",
    href: "/profile/address",
    icon: MapPin,
  },
  {
    title: "Wishlist",
    href: "/profile/wishlist",
    icon: Heart,
  },
]

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { toast } = useToast();
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Hello, {user?.first_name ? user.first_name : "User"}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your account settings</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {item.title}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          onClick={() => {
            logout();
            toast({
              title: "Logged out",
              description: "You have been signed out successfully.",
              variant: "default",
              className: "bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4",
              action: <LogOut className="inline-block mr-2 h-4 w-4 align-text-bottom" />
            });
            setTimeout(() => {
              window.location.href = "/auth";
            }, 800);
          }}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Mobile Sidebar */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <div className="lg:hidden p-4">
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="bg-white dark:bg-gray-900">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SheetTrigger>
          </div>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
