'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, Eye, Edit, Package, MapPin, User, CreditCard } from 'lucide-react'

const ordersData = [
  {
    id: '#ORD-001',
    customer: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
    },
    items: [
      { name: 'Gaming Mouse Pro X', quantity: 1, price: 89.99 },
      { name: 'RGB Gaming Mousepad', quantity: 1, price: 29.99 },
    ],
    status: 'completed',
    total: 119.98,
    date: '2024-01-15',
    shipping: {
      address: '123 Main St, New York, NY 10001',
      method: 'Standard Shipping',
    },
    payment: {
      method: 'Credit Card',
      last4: '4242',
    },
  },
  {
    id: '#ORD-002',
    customer: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+1 (555) 987-6543',
    },
    items: [
      { name: 'Wireless Controller Elite', quantity: 1, price: 159.99 },
    ],
    status: 'processing',
    total: 159.99,
    date: '2024-01-15',
    shipping: {
      address: '456 Oak Ave, Los Angeles, CA 90210',
      method: 'Express Shipping',
    },
    payment: {
      method: 'PayPal',
      last4: null,
    },
  },
  {
    id: '#ORD-003',
    customer: {
      name: 'Mike Johnson',
      email: 'mike@example.com',
      phone: '+1 (555) 456-7890',
    },
    items: [
      { name: 'Mechanical Keyboard', quantity: 1, price: 199.99 },
    ],
    status: 'pending',
    total: 199.99,
    date: '2024-01-14',
    shipping: {
      address: '789 Pine St, Chicago, IL 60601',
      method: 'Standard Shipping',
    },
    payment: {
      method: 'Credit Card',
      last4: '1234',
    },
  },
  {
    id: '#ORD-004',
    customer: {
      name: 'Sarah Wilson',
      email: 'sarah@example.com',
      phone: '+1 (555) 321-0987',
    },
    items: [
      { name: 'Handheld Gaming PC', quantity: 1, price: 699.99 },
    ],
    status: 'cancelled',
    total: 699.99,
    date: '2024-01-13',
    shipping: {
      address: '321 Elm St, Miami, FL 33101',
      method: 'Express Shipping',
    },
    payment: {
      method: 'Credit Card',
      last4: '5678',
    },
  },
]

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  const filteredOrders = ordersData.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    
    return (
      <Badge className={`${config.color} hover:${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order)
    setIsDetailDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
        <p className="text-slate-600 mt-2">Manage customer orders and track fulfillment</p>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search orders, customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            A list of all orders in your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer.name}</div>
                      <div className="text-sm text-slate-600">{order.customer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="font-medium">${order.total.toFixed(2)}</TableCell>
                  <TableCell className="text-slate-600">{order.date}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Update Status
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Package className="h-4 w-4 mr-2" />
                          Track Package
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Complete information about this order
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="font-medium">{selectedOrder.customer.name}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.customer.email}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.customer.phone}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Shipping Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm">{selectedOrder.shipping.address}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.shipping.method}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Order Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                        </div>
                        <p className="font-medium">${item.price.toFixed(2)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 border-t font-bold">
                      <span>Total</span>
                      <span>${selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span>{selectedOrder.payment.method}</span>
                    {selectedOrder.payment.last4 && (
                      <span className="text-slate-600">**** {selectedOrder.payment.last4}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
