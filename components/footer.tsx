import { Facebook, Twitter, Instagram, Youtube, Mail } from "lucide-react"
import ScrollableLink from "./scrollable-link"

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="container px-4 py-12 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-4 flex flex-col h-full justify-between">
            <div>
              <ScrollableLink href="/" className="flex items-center gap-2 font-bold text-xl">
                <span className="gradient-text-light dark:gradient-text-dark">NexusGear</span>
              </ScrollableLink>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                Premium gaming peripherals designed for performance, comfort, and victory.
              </p>
            </div>
            <div className="flex space-x-4 mt-4">
              <ScrollableLink href="#" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors"><Facebook className="h-5 w-5" /><span className="sr-only">Facebook</span></ScrollableLink>
              <ScrollableLink href="#" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors"><Twitter className="h-5 w-5" /><span className="sr-only">Twitter</span></ScrollableLink>
              <ScrollableLink href="#" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors"><Instagram className="h-5 w-5" /><span className="sr-only">Instagram</span></ScrollableLink>
              <ScrollableLink href="#" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors"><Youtube className="h-5 w-5" /><span className="sr-only">YouTube</span></ScrollableLink>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-8">
            {/* Products */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Products</h3>
              <ul className="space-y-2 text-sm">
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">PC Handheld</ScrollableLink></li>
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Controller</ScrollableLink></li>
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Gaming Mouse</ScrollableLink></li>
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Accessories</ScrollableLink></li>
              </ul>
            </div>
            {/* Company */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><ScrollableLink href="/about" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">About Us</ScrollableLink></li>
                <li><ScrollableLink href="/contact" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Contact</ScrollableLink></li>
                <li><ScrollableLink href="/policy" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Policies</ScrollableLink></li>
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Careers</ScrollableLink></li>
              </ul>
            </div>
            {/* Support */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><ScrollableLink href="/contact" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Help Center</ScrollableLink></li>
                <li><ScrollableLink href="/policy" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Warranty</ScrollableLink></li>
                <li><ScrollableLink href="/policy" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Returns</ScrollableLink></li>
                <li><ScrollableLink href="#" className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-purple-500 transition-colors">Track Order</ScrollableLink></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0 text-left w-full md:w-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Stay Updated</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Get the latest news and exclusive offers</p>
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 md:w-64 px-4 py-2 bg-white border border-gray-300 dark:bg-gray-900 dark:border-gray-700 rounded-l-md focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-500 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-md transition-colors">
                <Mail className="h-4 w-4" />
                <span className="sr-only">Subscribe</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 dark:text-gray-400">
          <p>&copy; 2025 NexusGear. All rights reserved.</p>
          <div className="hidden md:flex space-x-6 mt-4 md:mt-0">
            <ScrollableLink href="/policy" className="hover:text-blue-600 dark:hover:text-purple-500 transition-colors">
              Privacy Policy
            </ScrollableLink>
            <ScrollableLink href="/policy" className="hover:text-blue-600 dark:hover:text-purple-500 transition-colors">
              Terms of Service
            </ScrollableLink>
            <ScrollableLink
              href="/contact"
              className="hover:text-blue-600 dark:hover:text-purple-500 transition-colors"
            >
              Support
            </ScrollableLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
