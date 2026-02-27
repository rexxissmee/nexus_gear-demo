import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PolicyPage() {
  return (
    <main className="flex-1 container px-4 py-16 mx-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Policies & Warranty Information</h1>

        <Tabs defaultValue="service" className="mb-12">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="service">Service Policy</TabsTrigger>
            <TabsTrigger value="warranty">Warranty</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="service" className="mt-6">
            <div className="prose prose-invert max-w-none">
              <h2 className="text-2xl font-semibold mb-4">Service Policy</h2>

              <p className="mb-4">
                At NexusGear, we are committed to providing exceptional service to our customers. This policy outlines
                what you can expect when shopping with us.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Order Processing</h3>
              <p className="mb-4">
                Orders are typically processed within 1-2 business days. During peak seasons or promotional periods,
                processing may take up to 3 business days. You will receive an email confirmation once your order has
                been processed and shipped.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Shipping</h3>
              <p className="mb-4">We offer several shipping options:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Standard Shipping: 3-5 business days</li>
                <li>Express Shipping: 1-2 business days</li>
                <li>International Shipping: 7-14 business days</li>
              </ul>
              <p className="mb-4">
                Shipping costs are calculated based on the weight of your order and your location. Free shipping is
                available for orders over $100 within the continental United States.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Returns & Exchanges</h3>
              <p className="mb-4">
                We accept returns within 30 days of purchase. Items must be in their original condition with all
                packaging and accessories. To initiate a return, please contact our customer service team.
              </p>
              <p className="mb-4">
                Exchanges are processed once we receive your returned item. If you need an immediate replacement, we
                recommend placing a new order and returning the original item for a refund.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Refunds</h3>
              <p className="mb-4">
                Refunds are processed within 5-7 business days after we receive your returned item. The refund will be
                issued to the original payment method used for the purchase.
              </p>
              <p className="mb-4">
                Please note that shipping costs are non-refundable unless the return is due to our error or a defective
                product.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="warranty" className="mt-6">
            <div className="prose prose-invert max-w-none">
              <h2 className="text-2xl font-semibold mb-4">Product Warranty</h2>

              <p className="mb-4">
                NexusGear stands behind the quality of our products. All our gaming peripherals come with a
                comprehensive warranty to ensure your satisfaction and peace of mind.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Warranty Coverage</h3>
              <p className="mb-4">
                Our standard warranty covers defects in materials and workmanship under normal use for the following
                periods:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>PC Handheld: 2 years</li>
                <li>Controller: 2 years</li>
                <li>Gaming mouse: 1 year</li>
                <li>Accessories: 1 year</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">What's Covered</h3>
              <p className="mb-4">Our warranty covers:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Manufacturing defects</li>
                <li>Electrical or mechanical failures not caused by misuse</li>
                <li>Dead-on-arrival products</li>
                <li>Premature wear under normal use</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">What's Not Covered</h3>
              <p className="mb-4">The following are not covered under our warranty:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Damage from accidents, misuse, or abuse</li>
                <li>Water damage or exposure to extreme conditions</li>
                <li>Normal wear and tear</li>
                <li>Products with altered or removed serial numbers</li>
                <li>Products purchased from unauthorized resellers</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">How to Claim Warranty</h3>
              <p className="mb-4">To claim warranty service:</p>
              <ol className="list-decimal pl-6 mb-4 space-y-2">
                <li>Contact our customer service team with your order number and a description of the issue</li>
                <li>Our team will provide troubleshooting assistance</li>
                <li>If the issue cannot be resolved, we'll provide instructions for returning the product</li>
                <li>Once received and verified, we'll repair or replace your product</li>
              </ol>

              <p className="mb-4">For warranty claims, please contact: support@nexusgear.com</p>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="mt-6">
            <div className="prose prose-invert max-w-none">
              <h2 className="text-2xl font-semibold mb-4">Privacy Policy</h2>

              <p className="mb-4">
                Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you visit our website or make a purchase.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Information We Collect</h3>
              <p className="mb-4">
                We may collect personal information that you voluntarily provide when creating an account, placing an
                order, or signing up for our newsletter, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name, email address, and contact information</li>
                <li>Billing and shipping address</li>
                <li>Payment information (processed securely through our payment processors)</li>
                <li>Order history and preferences</li>
              </ul>

              <p className="mb-4">
                We also automatically collect certain information when you visit our website, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>IP address and browser type</li>
                <li>Pages viewed and time spent on our site</li>
                <li>Referring website or source</li>
                <li>Device information</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">How We Use Your Information</h3>
              <p className="mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Process and fulfill your orders</li>
                <li>Communicate with you about your order or account</li>
                <li>Send you marketing communications (if you've opted in)</li>
                <li>Improve our website and product offerings</li>
                <li>Detect and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">Cookies</h3>
              <p className="mb-4">
                We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You
                can control cookies through your browser settings.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Third-Party Disclosure</h3>
              <p className="mb-4">
                We do not sell or trade your personal information. We may share information with trusted third parties
                who assist us in operating our website, conducting business, or servicing you, as long as they agree to
                keep this information confidential.
              </p>

              <h3 className="text-xl font-semibold mt-6 mb-3">Your Rights</h3>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Access and update your personal information</li>
                <li>Opt-out of marketing communications</li>
                <li>Request deletion of your data (subject to legal requirements)</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">Contact Us</h3>
              <p className="mb-4">
                If you have questions about our Privacy Policy, please contact us at privacy@nexusgear.com
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I check my warranty status?</AccordionTrigger>
              <AccordionContent>
                You can check your warranty status by logging into your account and viewing your order history. Each
                product will display its warranty expiration date. Alternatively, you can contact our customer support
                team with your order number for assistance.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>What is your return window?</AccordionTrigger>
              <AccordionContent>
                We offer a 30-day return window for most products. Items must be in their original condition with all
                packaging and accessories. Custom or personalized items may not be eligible for return unless they are
                defective.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Do you offer extended warranties?</AccordionTrigger>
              <AccordionContent>
                Yes, we offer extended warranty options on select products. Extended warranties can be purchased at
                checkout and provide additional coverage beyond our standard warranty period. Extended warranties cover
                the same issues as our standard warranty for an additional 1-2 years depending on the product.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How do I request a refund?</AccordionTrigger>
              <AccordionContent>
                To request a refund, please contact our customer service team with your order number and reason for the
                refund. If approved, refunds are processed within 5-7 business days and will be issued to the original
                payment method. Please note that shipping costs are generally non-refundable unless the return is due to
                our error.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
              <AccordionContent>
                We accept major credit cards (Visa, Mastercard, American Express, Discover), PayPal, Apple Pay, and
                Google Pay. All payments are securely processed and encrypted. We do not store your full credit card
                information on our servers.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </main>
  )
}
