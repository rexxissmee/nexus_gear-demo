import type React from "react"
import type { Metadata } from "next"
import ClientLayout from "./ClientLayout"
import './globals.css'

export const metadata: Metadata = {
  title: "NexusGear | Premium Gaming Peripherals",
  description: "Shop the best gaming keyboards, mice, headsets and accessories for competitive gaming.",
  icons: {
    icon: "/images/nexus-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ClientLayout>
    {children}
  </ClientLayout>
}

