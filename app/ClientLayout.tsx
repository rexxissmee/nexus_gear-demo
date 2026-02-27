"use client"
import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { ThemeProvider } from "@/components/theme-provider"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"

function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname])

  return null
}

function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  if (!isVisible) {
    return null
  }

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full gradient-btn-light dark:gradient-btn-dark text-white shadow-lg transition-all duration-300 hover:scale-110"
      size="icon"
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  )
}

const inter = Inter({ subsets: ["latin"] })

export default function ClientLayout({
  children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
          storageKey="nexusgear-theme"
        >
          {!isAdmin && <ScrollToTop />}
          {!isAdmin && <Navbar />}
          {children}
          {!isAdmin && <Footer />}
          {!isAdmin && <BackToTopButton />}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
