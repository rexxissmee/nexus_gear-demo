'use client'

import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Category = {
  id: number
  name: string
  description: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const { toast } = useToast()

  const API_URL = '/api/categories'

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch(API_URL, { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Failed to load categories'))
      setCategories(data.data || [])
    } catch (err: any) {
      toast({
        title: 'Load Failed',
        description: err?.message || 'Unable to load categories.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    )
  }

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setIsEditDialogOpen(true)
  }

  function CategoryForm({
    category,
    onClose,
    onSuccess,
  }: {
    category?: Category | null
    onClose: () => void
    onSuccess: () => void
  }) {
    const [name, setName] = useState<string>(category?.name || '')
    const [description, setDescription] = useState<string>(category?.description || '')
    const [status, setStatus] = useState<'active' | 'inactive'>(category?.status || 'active')
    const [submitting, setSubmitting] = useState<boolean>(false)

    const handleSubmit = async () => {
      if (!name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Category name is required.',
          variant: 'destructive',
          className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
        })
        return
      }

      try {
        setSubmitting(true)
        if (category) {
          const res = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: category.id, name: name.trim(), description: description.trim(), status }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Update failed'))

          toast({
            title: 'Updated',
            description: 'Category updated successfully.',
            variant: 'default',
            className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
          })
        } else {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), description: description.trim(), status }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Create failed'))

          toast({
            title: 'Created',
            description: 'Category created successfully.',
            variant: 'default',
            className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
          })
        }
        await fetchCategories()
        onSuccess()
        onClose()
      } catch (err: any) {
        toast({
          title: 'Operation Failed',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
          className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
        })
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Category Name</Label>
          <Input
            id="name"
            placeholder="Enter category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Enter category description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {category ? (submitting ? 'Updating...' : 'Update Category') : (submitting ? 'Creating...' : 'Create Category')}
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
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-600 mt-2">Manage your product categories</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription>
                Create a new product category for your store.
              </DialogDescription>
            </DialogHeader>
            <CategoryForm onClose={() => setIsAddDialogOpen(false)} onSuccess={() => {}} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-600">Loading categories...</TableCell>
                </TableRow>
              )}
              {!loading && filteredCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-600">No categories found.</TableCell>
                </TableRow>
              )}
              {!loading && filteredCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-slate-600">{category.description || '-'}</TableCell>
                  <TableCell>{getStatusBadge(category.status)}</TableCell>
                  <TableCell className="text-slate-600">{category.created_at}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(category)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={async () => {
                            const confirmed = window.confirm(`Delete category "${category.name}"?`)
                            if (!confirmed) return
                            try {
                              const url = `${API_URL}?id=${category.id}`
                              const res = await fetch(url, { method: 'DELETE' })
                              const data = await res.json()
                              if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Delete failed'))
                              toast({
                                title: 'Deleted',
                                description: 'Category deleted successfully.',
                                variant: 'default',
                                className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
                              })
                              fetchCategories()
                            } catch (err: any) {
                              toast({
                                title: 'Delete Failed',
                                description: err?.message || 'Unable to delete category.',
                                variant: 'destructive',
                                className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4',
                              })
                            }
                          }}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category information.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            category={selectedCategory}
            onClose={() => setIsEditDialogOpen(false)}
            onSuccess={() => setSelectedCategory(null)}
          />
        </DialogContent>
      </Dialog>

      
    </div>
  )
}
