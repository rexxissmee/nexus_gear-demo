import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Download } from "lucide-react"

export default function OrdersPage() {
  const orders = [
    {
      id: "#NG-001",
      date: "December 15, 2024",
      status: "Delivered",
      total: "$279.98",
      items: [
        { name: "NexusKey Pro Mechanical Keyboard", price: "$149.99", quantity: 1 },
        { name: "SoundWave Pro Gaming Headset", price: "$129.99", quantity: 1 },
      ],
    },
    {
      id: "#NG-002",
      date: "December 10, 2024",
      status: "Processing",
      total: "$89.99",
      items: [{ name: "VelocityMouse Wireless", price: "$89.99", quantity: 1 }],
    },
    {
      id: "#NG-003",
      date: "December 5, 2024",
      status: "Shipped",
      total: "$29.99",
      items: [{ name: "PrecisionPad XL Gaming Mousepad", price: "$29.99", quantity: 1 }],
    },
    {
      id: "#NG-004",
      date: "November 28, 2024",
      status: "Delivered",
      total: "$199.98",
      items: [
        { name: "NexusKey Compact 60% Keyboard", price: "$99.99", quantity: 1 },
        { name: "RGB Keycap Set - Cosmic", price: "$39.99", quantity: 1 },
        { name: "SoundWave Lite Gaming Headset", price: "$69.99", quantity: 1 },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Orders</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track and manage your orders</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{order.id}</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{order.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      order.status === "Delivered" ? "default" : order.status === "Processing" ? "secondary" : "outline"
                    }
                    className={
                      order.status === "Delivered"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : order.status === "Processing"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    }
                  >
                    {order.status}
                  </Badge>
                  <span className="font-semibold text-lg">{order.total}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Quantity: {item.quantity}</p>
                    </div>
                    <p className="font-medium">{item.price}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </Button>
                {order.status === "Processing" && (
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 bg-transparent">
                    Cancel Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
