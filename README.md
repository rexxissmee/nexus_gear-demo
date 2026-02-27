# Nexus Gear - Gaming E-commerce Platform

Modern e-commerce platform for gaming peripherals built with Next.js 14, Prisma, and PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 7.3.0
- **Authentication**: bcrypt
- **UI Components**: shadcn/ui
- **State Management**: Zustand

## Features

- 🛍️ Product browsing and search
- 🛒 Shopping cart management
- 👤 User authentication and profiles
- 🔐 Admin panel (products, categories, users)
- 📦 Order management
- 🖼️ Product image upload
- 💳 Multiple payment methods support
- 📱 Responsive design

## Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- PostgreSQL database (Supabase account)

## Getting Started

### 1. Clone repository

```bash
git clone https://github.com/rexxissmee/nexus_gear.git
cd nexus_gear
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Setup environment variables

Create `.env` file in root directory:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

### 4. Run database migrations

```bash
pnpm prisma migrate deploy
```

### 5. Seed database (optional)

```bash
pnpm prisma db seed
```

This will create:
- 5 product categories
- 21 sample products
- 4 test users (including admin account)

### 6. Start development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Default Admin Account

```
Email: admin@nexusgear.com
Password: admin123
```

## Project Structure

```
nexus_gear/
├── app/                  # Next.js App Router
│   ├── api/             # API routes (9 endpoints)
│   ├── admin/           # Admin dashboard
│   ├── auth/            # Authentication pages
│   ├── cart/            # Shopping cart
│   └── ...              # Other pages
├── components/          # React components
├── lib/                 # Utilities
│   ├── prisma.ts       # Prisma client
│   ├── upload.ts       # File upload handler
│   └── utils.ts        # Helper functions
├── prisma/             # Database schema & migrations
├── public/             # Static assets
└── store/              # Zustand stores
```

## API Endpoints

- `POST /api/login` - User authentication
- `POST /api/register` - User registration
- `GET /api/cart` - Get cart items
- `POST /api/cart` - Manage cart (add/update/remove/clear)
- `GET /api/products` - List products
- `POST /api/products` - Create/update product
- `GET /api/categories` - List categories
- `GET /api/users` - List users (admin)
- `POST /api/update-profile` - Update user profile

## Database Schema

### Main Models

- **User**: Customer and admin accounts
- **Category**: Product categories
- **Product**: Product listings with images
- **CartItem**: Shopping cart items
- **Order**: Customer orders
- **OrderDetail**: Order line items
- **Review**: Product reviews
- **Wishlist**: User wishlists

## Development

### Run Prisma Studio

```bash
pnpm prisma studio
```

### Generate Prisma Client

```bash
pnpm prisma generate
```

### Create new migration

```bash
pnpm prisma migrate dev --name your_migration_name
```

## Build for Production

```bash
pnpm build
pnpm start
```

## License

MIT

## Author

Developed by rexxissmee
