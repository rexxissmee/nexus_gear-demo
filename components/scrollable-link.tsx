"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type React from "react"

interface ScrollableLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  [key: string]: any
}

export default function ScrollableLink({ href, children, className, ...props }: ScrollableLinkProps) {
  const pathname = usePathname()

  const handleClick = (e: React.MouseEvent) => {
    if (pathname === href) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <Link href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}
