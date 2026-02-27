import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Award, Clock, Shield, Truck } from "lucide-react"

export default function AboutPage() {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative">
        <div className="container px-4 py-8 md:py-16 lg:py-20 mx-auto flex items-center justify-center min-h-[320px]">
          <div className="absolute inset-0 bg-[url('/images/banner.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50" />
          <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center justify-center w-full">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 md:mb-6 bg-clip-text text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              About NexusGear
            </h1>
            <p className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed text-gray-100 drop-shadow-[0_2px_12px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              We're passionate gamers on a mission to provide the highest quality gaming peripherals at competitive prices.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="container px-4 py-12 md:py-16 lg:py-20 mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center max-w-7xl mx-auto">
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
              Our Story
            </h2>
            <div className="space-y-4 md:space-y-6 text-gray-600 dark:text-gray-300 text-sm md:text-base leading-relaxed">
              <p>
                Founded in 2018 by a group of passionate gamers and tech enthusiasts, NexusGear was born from a simple
                idea: gaming gear should be high-quality, reliable, and accessible to everyone.
              </p>
              <p>
                We started in a small garage, testing and reviewing gaming peripherals, and quickly realized there was a
                gap in the market for premium gaming gear at reasonable prices. What began as a hobby turned into a
                mission to revolutionize the gaming peripheral industry.
              </p>
              <p>
                Today, NexusGear has grown into a trusted name in the gaming community, serving thousands of gamers
                worldwide. We maintain our core values of quality, innovation, and customer satisfaction in everything
                we do.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative h-64 md:h-80 lg:h-96 rounded-xl overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800">
              <Image src="/placeholder.svg?height=600&width=800" alt="Our team" fill className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="bg-gray-50 dark:bg-gray-950 py-12 md:py-16 lg:py-20">
        <div className="container px-4 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-white">
              Our Values
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
              The principles that guide everything we do at NexusGear
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
            <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
              <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
                <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-3 md:mb-4 mx-auto">
                  <Award className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-purple-500" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-center text-gray-900 dark:text-white">
                  Quality
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base text-center leading-relaxed">
                  We never compromise on the quality of our products, ensuring each item meets our rigorous standards.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
              <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
                <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-3 md:mb-4 mx-auto">
                  <Shield className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-purple-500" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-center text-gray-900 dark:text-white">
                  Trust
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base text-center leading-relaxed">
                  Building lasting relationships with our customers through honesty, transparency, and reliability.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
              <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
                <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-3 md:mb-4 mx-auto">
                  <Truck className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-purple-500" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-center text-gray-900 dark:text-white">
                  Service
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base text-center leading-relaxed">
                  Exceptional customer service is at the heart of our business, going above and beyond for our
                  community.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
              <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
                <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-3 md:mb-4 mx-auto">
                  <Clock className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-purple-500" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-center text-gray-900 dark:text-white">
                  Innovation
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base text-center leading-relaxed">
                  Constantly evolving and improving our products to meet the changing needs of gamers worldwide.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container px-4 py-16 mx-auto">
        <div className="bg-blue-50 rounded-xl p-8 md:p-12 text-center max-w-3xl mx-auto border border-blue-100">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900">Ready to Level Up Your Gaming?</h2>
          <p className="text-gray-600 mb-6">Join thousands of satisfied gamers who have upgraded their setup with NexusGear products.</p>
          <Button className="gradient-btn-light dark:gradient-btn-dark text-white" size="lg">Shop Now</Button>
        </div>
      </section>
    </main>
  )
}
