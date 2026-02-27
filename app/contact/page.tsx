"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, MapPin, Phone } from "lucide-react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const [formStatus, setFormStatus] = useState<null | "success" | "error">(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate form submission
    setTimeout(() => {
      setFormStatus("success")
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
      setTimeout(() => setFormStatus(null), 3000)
    }, 1000)
  }

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative">
        <div className="container px-4 py-8 md:py-16 lg:py-20 mx-auto flex items-center justify-center min-h-[320px]">
          <div className="absolute inset-0 bg-[url('/images/banner.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50" />
          <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center justify-center w-full">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 md:mb-6 bg-clip-text text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              Contact Us
            </h1>
            <p className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed text-gray-100 drop-shadow-[0_2px_12px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              Reach out to us for support, questions, or partnership opportunities. We're here to help!
            </p>
          </div>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="container px-4 py-12 md:py-16 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="pt-6 md:pt-8 p-4 md:p-6 flex flex-col items-center text-center">
              <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center mb-4 md:mb-6">
                <Phone className="h-6 w-6 md:h-8 md:w-8 text-blue-600 dark:text-purple-500" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white">Phone</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
                Mon-Fri from 8am to 5pm
              </p>
              <a
                href="tel:+1234567890"
                className="text-blue-600 dark:text-purple-500 hover:text-blue-700 dark:hover:text-purple-400 font-medium text-sm md:text-base"
              >
                +1 (234) 567-890
              </a>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="pt-6 md:pt-8 p-4 md:p-6 flex flex-col items-center text-center">
              <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center mb-4 md:mb-6">
                <Mail className="h-6 w-6 md:h-8 md:w-8 text-blue-600 dark:text-purple-500" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white">Email</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
                We'll respond within 24 hours
              </p>
              <a
                href="mailto:support@nexusgear.com"
                className="text-blue-600 dark:text-purple-500 hover:text-blue-700 dark:hover:text-purple-400 font-medium text-sm md:text-base"
              >
                support@nexusgear.com
              </a>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800 border-blue-200 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="pt-6 md:pt-8 p-4 md:p-6 flex flex-col items-center text-center">
              <div className="rounded-full bg-blue-100 dark:bg-purple-900/30 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center mb-4 md:mb-6">
                <MapPin className="h-6 w-6 md:h-8 md:w-8 text-blue-600 dark:text-purple-500" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white">Office</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3 md:mb-4 text-sm md:text-base">Come visit our store</p>
              <address className="not-italic text-blue-600 dark:text-purple-500 text-sm md:text-base text-center">
                123 Gaming Street
                <br />
                Tech City, TC 98765
              </address>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="container px-4 py-12 md:py-16 mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-start max-w-7xl mx-auto">
          <div className="bg-white/80 dark:bg-gray-800 rounded-xl p-6 md:p-8 border border-blue-200 dark:border-purple-700/30 shadow-lg">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
              Send Us a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                    Your Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="h-10 md:h-11 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="h-10 md:h-11 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                  Subject
                </Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="How can we help you?"
                  className="h-10 md:h-11 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                  Message
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Your message here..."
                  rows={5}
                  className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto gradient-btn-light dark:gradient-btn-dark text-white px-6 md:px-8 py-2 md:py-3 text-sm md:text-base"
              >
                Send Message
              </Button>

              {formStatus === "success" && (
                <p className="text-green-600 dark:text-green-400 text-sm md:text-base">
                  Your message has been sent successfully!
                </p>
              )}

              {formStatus === "error" && (
                <p className="text-red-600 dark:text-red-400 text-sm md:text-base">
                  There was an error sending your message. Please try again.
                </p>
              )}
            </form>
          </div>

          <div className="h-64 md:h-96 lg:h-full min-h-[400px] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-lg">
            {/* Google Maps Embed would go here */}
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-950 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <MapPin className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                <p className="text-sm md:text-base">Google Maps Embed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 dark:bg-gray-950 py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-center text-gray-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white/80 dark:bg-gray-800 rounded-lg p-4 md:p-6 border border-blue-200 dark:border-purple-700/30">
                <h3 className="font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white text-sm md:text-base">
                  What are your shipping times?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                  We process orders within 1-2 business days. Standard shipping takes 3-5 business days, while express
                  shipping takes 1-2 business days.
                </p>
              </div>
              <div className="bg-white/80 dark:bg-gray-800 rounded-lg p-4 md:p-6 border border-blue-200 dark:border-purple-700/30">
                <h3 className="font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white text-sm md:text-base">
                  Do you ship internationally?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                  Yes, we ship to most countries worldwide. International shipping typically takes 7-14 business days.
                </p>
              </div>
              <div className="bg-white/80 dark:bg-gray-800 rounded-lg p-4 md:p-6 border border-blue-200 dark:border-purple-700/30">
                <h3 className="font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white text-sm md:text-base">
                  What is your return policy?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                  We offer a 30-day return policy for most items. Products must be in original condition with all
                  packaging.
                </p>
              </div>
              <div className="bg-white/80 dark:bg-gray-800 rounded-lg p-4 md:p-6 border border-blue-200 dark:border-purple-700/30">
                <h3 className="font-semibold mb-2 md:mb-3 text-gray-900 dark:text-white text-sm md:text-base">
                  How can I track my order?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                  Once your order ships, you'll receive a tracking number via email that you can use to monitor your
                  delivery.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
