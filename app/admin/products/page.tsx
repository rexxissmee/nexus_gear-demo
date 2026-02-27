'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Package, Image as ImageIcon, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Product = {
  id: number
  name: string
  description: string | null
  price: number
  original_price: number | null
  thumbnail: string | null
  stock: number
  category_id: number | null
  is_featured: 0 | 1
  is_on_sale: 0 | 1
  is_new_arrival: 0 | 1
  created_at: string
}

type ProductImage = { id: number; image_url: string }
type Category = { id: number; name: string }

export default function ProductsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | number>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_stock'>('all')
  const [productFilter, setProductFilter] = useState<'all' | 'featured' | 'new_arrival' | 'on_sale'>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedImages, setSelectedImages] = useState<ProductImage[]>([])

  const categoryMap = useMemo(() => {
    const m = new Map<number, string>()
    categories.forEach(c => m.set(c.id, c.name))
    return m
  }, [categories])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Load categories failed'))
      setCategories(data.data ?? [])
    } catch (e: any) {
      toast({
        title: 'Load Failed',
        description: e?.message || 'Unable to load categories.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/products', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Load products failed'))
      setProducts(data.data ?? [])
    } catch (e: any) {
      toast({
        title: 'Load Failed',
        description: e?.message || 'Unable to load products.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'in_stock' && p.stock >= 20) ||
        (stockFilter === 'low_stock' && p.stock > 0 && p.stock < 20) ||
        (stockFilter === 'out_stock' && p.stock <= 0)
      return matchesSearch && matchesCategory && matchesStock
    })

    if (productFilter === 'featured') {
      result = result.filter(p => p.is_featured === 1)
    } else if (productFilter === 'new_arrival') {
      result = result.filter(p => p.is_new_arrival === 1)
    } else if (productFilter === 'on_sale') {
      result = result.filter(p => p.is_on_sale === 1)
    }

    return result
  }, [searchTerm, categoryFilter, stockFilter, productFilter, products])

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Out of Stock</Badge>
    if (stock < 20) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Low Stock</Badge>
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">In Stock</Badge>
  }

  const openEdit = async (product: Product) => {
    try {
      setSelectedProduct(null)
      setSelectedImages([])
      const url = `/api/products?id=${product.id}`
      const res = await fetch(url, { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Load product failed'))
      setSelectedProduct(data.data.product)
      setSelectedImages(data.data.images ?? [])
      setIsEditDialogOpen(true)
    } catch (e: any) {
      toast({
        title: 'Load Failed',
        description: e?.message || 'Unable to load product.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    const ok = window.confirm('Delete this product?')
    if (!ok) return
    try {
      const form = new FormData()
      form.append('action', 'delete')
      form.append('id', String(productId))
      const res = await fetch('/api/products', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Delete failed'))
      toast({
        title: 'Deleted',
        description: 'Product deleted successfully.',
        className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
      fetchProducts()
    } catch (e: any) {
      toast({
        title: 'Delete Failed',
        description: e?.message || 'Unable to delete.',
        variant: 'destructive',
        className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
      })
    }
  }

  function ProductForm({ product, images, onClose, onSuccess }: { product?: Product | null, images?: ProductImage[], onClose: () => void, onSuccess: () => void }) {
    const [submitting, setSubmitting] = useState(false)
    const [deleteImageIds, setDeleteImageIds] = useState<number[]>([])
    const thumbRef = useRef<HTMLInputElement | null>(null)
    const imgsRef = useRef<HTMLInputElement | null>(null)

    const [form, setForm] = useState({
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price?.toString() ?? '',
      original_price: product?.original_price?.toString() ?? '',
      stock: product?.stock?.toString() ?? '0',
      category_id: product?.category_id ? String(product.category_id) : '',
      is_featured: product?.is_featured === 1,
      is_on_sale: product?.is_on_sale === 1,
      is_new_arrival: product?.is_new_arrival === 1,
    })

    const toggleDeleteImage = (id: number) => {
      setDeleteImageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const handleSubmit = async () => {
      if (!form.name.trim() || !form.price) {
        toast({
          title: 'Validation Error',
          description: 'Name and price are required.',
          variant: 'destructive',
          className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
        })
        return
      }
      try {
        setSubmitting(true)
        const fd = new FormData()
        if (product) {
          fd.append('action', 'update')
          fd.append('id', String(product.id))
        } else {
          fd.append('action', 'create')
        }
        fd.append('name', form.name.trim())
        fd.append('description', form.description.trim())
        fd.append('price', form.price)
        if (form.original_price !== '') fd.append('original_price', form.original_price)
        fd.append('stock', form.stock)
        if (form.category_id !== '') fd.append('category_id', form.category_id)
        fd.append('is_featured', String(form.is_featured))
        fd.append('is_on_sale', String(form.is_on_sale))
        fd.append('is_new_arrival', String(form.is_new_arrival))

        const thumbFile = thumbRef.current?.files?.[0]
        if (thumbFile) fd.append('thumbnail', thumbFile)
        const imagesFiles = imgsRef.current?.files
        if (imagesFiles && imagesFiles.length > 0) {
          for (let i = 0; i < imagesFiles.length; i++) {
            fd.append('images[]', imagesFiles[i])
          }
        }

        if (product && deleteImageIds.length > 0) {
          fd.append('delete_image_ids', deleteImageIds.join(','))
        }

        const res = await fetch('/api/products', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0] : (data.error || 'Save failed'))

        toast({
          title: product ? 'Updated' : 'Created',
          description: `Product ${product ? 'updated' : 'created'} successfully.`,
          variant: 'default',
          className: 'bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
        })
        await fetchProducts()
        onSuccess()
        onClose()
      } catch (e: any) {
        toast({
          title: 'Failed',
          description: e?.message || 'Operation failed.',
          variant: 'destructive',
          className: 'bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4'
        })
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price">Price</Label>
            <Input id="price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="original_price">Original Price</Label>
            <Input id="original_price" type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="stock">Stock</Label>
            <Input id="stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_on_sale} onChange={(e) => setForm({ ...form, is_on_sale: e.target.checked })} /> On Sale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_new_arrival} onChange={(e) => setForm({ ...form, is_new_arrival: e.target.checked })} /> New Arrival
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Thumbnail</Label>
            <Input ref={thumbRef} type="file" accept="image/*" />
            {product?.thumbnail && (
              <div className="mt-2 text-sm text-slate-600 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Current: <a href={product.thumbnail} target="_blank" className="text-blue-600">view</a>
              </div>
            )}
          </div>
          <div>
            <Label>Additional Images</Label>
            <Input ref={imgsRef} type="file" accept="image/*" multiple />
            {images && images.length > 0 && (
              <div className="mt-3 space-y-2 max-h-40 overflow-auto pr-1">
                {images.map(img => (
                  <div key={img.id} className="flex items-center justify-between text-sm">
                    <a href={img.image_url} target="_blank" className="text-blue-600 truncate max-w-[70%]">{img.image_url}</a>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={deleteImageIds.includes(img.id)} onChange={() => toggleDeleteImage(img.id)} />
                      Remove
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? (product ? 'Updating...' : 'Creating...') : (product ? 'Update Product' : 'Create Product')}</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-600 mt-2">Manage your product inventory</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Create a new product for your store.</DialogDescription>
            </DialogHeader>
            <ProductForm onClose={() => setIsAddDialogOpen(false)} onSuccess={() => { }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center justify-end mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="min-w-[150px]">
              <Select onValueChange={(value) => setCategoryFilter(value === 'all' ? 'all' : parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select onValueChange={(value) => setProductFilter(value as 'all' | 'featured' | 'new_arrival' | 'on_sale')}>
                <SelectTrigger>
                  <SelectValue placeholder="Special" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="new_arrival">New Arrival</SelectItem>
                  <SelectItem value="on_sale">On Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select onValueChange={(value) => setStockFilter(value as 'all' | 'in_stock' | 'low_stock' | 'out_stock')}>
                <SelectTrigger>
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading && (
          <div className="col-span-full text-center text-slate-600">Loading products...</div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="col-span-full text-center text-slate-600">No products found.</div>
        )}
        {!loading && filteredProducts.map((p) => (
          <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow relative">
            {p.is_on_sale === 1 && p.original_price && (
              <Badge className="absolute top-3 left-3 bg-red-600 hover:bg-red-700">-{Math.round(((p.original_price - p.price) / p.original_price) * 100)}%</Badge>
            )}
            {p.is_featured === 1 && (
              <Badge className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700">Featured</Badge>
            )}
            <CardContent className="p-4 flex flex-col h-full">
              <div className="aspect-square bg-slate-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-12 w-12 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col flex-1">
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold text-slate-900 line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                  <p className="text-sm text-slate-600">{p.category_id ? (categoryMap.get(p.category_id) || '—') : '—'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">${p.price}</span>
                    {getStockBadge(p.stock)}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => window.open(`/product/${p.id}`, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Detail
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteProduct(p.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product information.</DialogDescription>
          </DialogHeader>
          <ProductForm product={selectedProduct} images={selectedImages} onClose={() => setIsEditDialogOpen(false)} onSuccess={() => { setSelectedProduct(null); setSelectedImages([]) }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
