'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, ShoppingCart, DollarSign, Activity, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const statsData = [
  {
    title: 'Total Users',
    value: '2,847',
    change: '+12.5%',
    trend: 'up',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Total Orders',
    value: '1,234',
    change: '+8.2%',
    trend: 'up',
    icon: ShoppingCart,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    title: 'Revenue',
    value: '$45,678',
    change: '+15.3%',
    trend: 'up',
    icon: DollarSign,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Active Sessions',
    value: '573',
    change: '-2.1%',
    trend: 'down',
    icon: Activity,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
]

const chartData = [
  { month: 'Jan', revenue: 12000 },
  { month: 'Feb', revenue: 15000 },
  { month: 'Mar', revenue: 18000 },
  { month: 'Apr', revenue: 22000 },
  { month: 'May', revenue: 25000 },
  { month: 'Jun', revenue: 28000 },
  { month: 'Jul', revenue: 32000 },
  { month: 'Aug', revenue: 35000 },
  { month: 'Sep', revenue: 38000 },
  { month: 'Oct', revenue: 42000 },
  { month: 'Nov', revenue: 45000 },
  { month: 'Dec', revenue: 48000 },
]

const recentOrders = [
  {
    id: '#ORD-001',
    customer: 'John Doe',
    status: 'completed',
    total: '$299.99',
    date: '2024-01-15',
  },
  {
    id: '#ORD-002',
    customer: 'Jane Smith',
    status: 'processing',
    total: '$159.99',
    date: '2024-01-15',
  },
  {
    id: '#ORD-003',
    customer: 'Mike Johnson',
    status: 'pending',
    total: '$89.99',
    date: '2024-01-14',
  },
  {
    id: '#ORD-004',
    customer: 'Sarah Wilson',
    status: 'completed',
    total: '$199.99',
    date: '2024-01-14',
  },
  {
    id: '#ORD-005',
    customer: 'Tom Brown',
    status: 'cancelled',
    total: '$79.99',
    date: '2024-01-13',
  },
]

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

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat) => {
          const Icon = stat.icon
          const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown

          return (
            <Card key={stat.title} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                    <div className="flex items-center mt-2">
                      <TrendIcon className={`h-4 w-4 mr-1 ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
                      <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-slate-500 ml-1">from last month</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>Revenue trends over the past 12 months</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    interval="preserveStartEnd"
                    padding={{ right: 8 }}
                  />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from your customers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="font-medium">{order.total}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
