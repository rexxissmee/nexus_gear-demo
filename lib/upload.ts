import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'images', 'product-images')
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function saveUploadedFile(file: File, subdir?: string): Promise<{ success: boolean; path?: string; errors?: string[] }> {
  try {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, errors: ['Invalid file type. Only images are allowed.'] }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, errors: ['File size exceeds 5MB limit.'] }
    }

    await ensureUploadDir()

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg'
    const unique = `img_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const fileName = `${unique}.${safeExt}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save file
    const filePath = path.join(UPLOAD_DIR, fileName)
    await writeFile(filePath, buffer)

    // Return web-relative path
    return { success: true, path: `/images/product-images/${fileName}` }
  } catch (error) {
    console.error('File upload error:', error)
    return { success: false, errors: ['Failed to upload file.'] }
  }
}

export async function deleteFile(webPath: string): Promise<void> {
  try {
    if (!webPath || !webPath.startsWith('/images/product-images/')) {
      return
    }

    const filePath = path.join(process.cwd(), 'public', webPath)

    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  } catch (error) {
    console.error('File deletion error:', error)
  }
}
