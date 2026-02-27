'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Mail, Phone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [usersData, setUsersData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const { toast } = useToast()
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [viewUser, setViewUser] = useState<any>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/users')
        const json = await res.json()
        if (res.ok) {
          const mapped = (json.data || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role === 'admin' ? 'admin' : 'customer',
            status: 'active',
            totalSpent: Number(u.total_spent || 0),
            orders: Number(u.orders || u.orders_count || 0),
            joined: u.joined,
            avatar: '/placeholder.svg?height=40&width=40',
          }))
          setUsersData(mapped)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = usersData.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Admin</Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Customer</Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    )
  }

  const handleEdit = (user: any) => {
    setSelectedUser(user)
    setIsEditDialogOpen(true)
  }

  const handleView = (user: any) => {
    setViewUser(user)
    setIsViewOpen(true)
  }

  const handleDelete = async (userId: number) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: userId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Delete failed')
      setUsersData(prev => prev.filter(u => u.id !== userId))
      toast({
        title: 'User deleted',
        description: 'The user has been removed successfully.',
        className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message || 'Unable to delete user.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    }
  }

  const submitEdit = async (form: { name: string; email: string; phone: string; role: string; status: string }) => {
    if (!selectedUser) return setIsEditDialogOpen(false)
    try {
      const nameParts = (form.name || '').trim().split(' ')
      const first_name = nameParts.shift() || ''
      const last_name = nameParts.join(' ')
      const payload = {
        action: 'update',
        id: selectedUser.id,
        first_name,
        last_name,
        email: form.email,
        phone: form.phone,
        role: (form.role === 'admin' ? 'admin' : 'user'),
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.[0] || data?.error || 'Update failed')
      setUsersData(prev => prev.map(u => u.id === selectedUser.id ? { ...u, name: form.name, email: form.email, phone: form.phone, role: form.role, status: form.status } : u))
      toast({
        title: 'User updated',
        description: 'Changes have been saved.',
        className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
      setIsEditDialogOpen(false)
    } catch (e: any) {
      toast({
        title: 'Update failed',
        description: e?.message || 'Unable to update user.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    }
  }

  const UserForm = ({ user, onClose }: { user?: any; onClose: () => void }) => {
    const [form, setForm] = useState({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || 'customer',
      status: user?.status || 'active',
    })
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter full name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="Enter phone number"
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={form.role} onValueChange={(val) => setForm(prev => ({ ...prev, role: val }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={form.status} onValueChange={(val) => setForm(prev => ({ ...prev, status: val }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => { submitEdit(form) }}>
            {user ? 'Update' : 'Create'} User
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-600 mt-2">Manage customer accounts and administrators</p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            A list of all users in your system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">User</TableHead>
                <TableHead className="text-left">Contact</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Joined at</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">No users found</TableCell>
                </TableRow>
              ) : filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{user.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-slate-400" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {user.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="justify-center min-w-24">{user.orders} orders</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">${user.totalSpent.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-slate-600">{new Date(user.joined).toISOString().slice(0,10)}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(user)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => { setDeleteUserId(user.id); setIsDeleteOpen(true) }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user information.
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            user={selectedUser} 
            onClose={() => setIsEditDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Basic information about this user</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={viewUser.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{viewUser.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{viewUser.name}</div>
                  <div className="text-sm text-slate-600">Joined {new Date(viewUser.joined).toISOString().slice(0,10)}</div>
                </div>
              </div>
              <div className="text-sm"><span className="text-slate-500">Email:</span> {viewUser.email}</div>
              <div className="text-sm"><span className="text-slate-500">Phone:</span> {viewUser.phone}</div>
              <div className="text-sm"><span className="text-slate-500">Role:</span> {viewUser.role === 'admin' ? 'Admin' : 'Customer'}</div>
              <div className="text-sm"><span className="text-slate-500">Orders:</span> {viewUser.orders}</div>
              <div className="text-sm"><span className="text-slate-500">Total Spent:</span> ${viewUser.totalSpent?.toFixed(2)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteUserId) handleDelete(deleteUserId); setIsDeleteOpen(false); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
