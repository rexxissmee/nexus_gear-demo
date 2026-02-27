import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (in reverse order of dependencies)
  await prisma.wishlist.deleteMany()
  await prisma.review.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.orderDetail.deleteMany()
  await prisma.order.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Cleared existing data')

  // Seed Categories
  const categories = await prisma.category.createMany({
    data: [
      {
        id: 1,
        name: 'PC Handheld',
        description: 'Portable gaming PCs and handheld gaming devices for gaming on the go',
        status: 'active',
        createdAt: new Date('2025-08-07'),
      },
      {
        id: 2,
        name: 'Controller',
        description: 'Wireless controllers, racing wheels, and arcade fight sticks',
        status: 'active',
        createdAt: new Date('2025-08-07'),
      },
      {
        id: 3,
        name: 'Gaming Mouse',
        description: 'High-precision gaming mouse with customizable DPI and RGB lighting',
        status: 'active',
        createdAt: new Date('2025-08-07'),
      },
      {
        id: 4,
        name: 'Accessories',
        description: 'Gaming mousepads, stands, LED strips, and other gaming essentials',
        status: 'active',
        createdAt: new Date('2025-08-07'),
      },
      {
        id: 5,
        name: 'Power bank',
        description: 'Extend gaming time with high capacity power bank',
        status: 'inactive',
        createdAt: new Date('2025-08-09'),
      },
    ],
  })
  console.log('✅ Created 5 categories')

  // Seed Users
  const users = await prisma.user.createMany({
    data: [
      {
        id: 1,
        firstName: 'Administrator 01',
        lastName: null,
        email: 'admin01@nexusgear.com',
        phone: '0987654321',
        password: '$2y$10$vZVw5sNK3YqPj7QZid6Ziu7hvXKakQwS3w58sNN7dI63TCAbVPj3.',
        role: 'admin',
      },
      {
        id: 2,
        firstName: 'Hung',
        lastName: 'Quach',
        email: 'rexxissmee@gmail.com',
        phone: '0972314822',
        dateOfBirth: new Date('2005-02-04'),
        gender: 'Male',
        password: '$2y$10$ntMl81TFvZHPyjmuACsKKOrgGDYPiYHdnHDmiE7kEzyW2Fvz/XqEu',
        role: 'user',
        addressStreet: '137 Nguyen Truyen Thanh',
        addressWard: 'Binh Thuy',
        addressCity: 'Can Tho',
        addressCountry: 'Viet Nam',
      },
      {
        id: 3,
        firstName: 'Khang',
        lastName: 'Le',
        email: 'khanglee2k5@gmail.com',
        phone: '0914496322',
        dateOfBirth: new Date('2004-04-20'),
        gender: 'Male',
        password: '$2y$10$5/ERUkHqVwS9Q8s9Jm8/WuzHw.XuEP9wE31SAnK5jWVA0qatSICzu',
        role: 'user',
      },
      {
        id: 6,
        firstName: 'Khang',
        lastName: 'Duong Van',
        email: 'duongvankhang2021@gmail.com',
        phone: '0867046251',
        dateOfBirth: new Date('2005-12-06'),
        password: '$2y$10$M0jrj73Kk3a7b5PEfhZSmu3E4/ioYNqgSJK/v/TuUJDejiJkzw8gy',
        role: 'user',
        addressCity: 'Can Tho',
        addressCountry: 'Vietnam',
      },
    ],
  })
  console.log('✅ Created 4 users (1 admin, 3 customers)')

  // Seed Products
  const products = await prisma.product.createMany({
    data: [
      {
        id: 1,
        name: 'Valve Steam Deck (512GB)',
        description: 'Portable PC gaming console with 512GB SSD, 7-inch touchscreen, and access to the full Steam game library.',
        price: 649.00,
        originalPrice: 649.00,
        thumbnail: 'https://images.tcdn.com.br/img/img_prod/616573/console_steam_deck_16gb_ram_1067_2_5e9f703c4579f57b6ce610ee45f5f57d.jpg',
        stock: 15,
        categoryId: 1,
        averageRating: 4.50,
        reviewCount: 150,
        isFeatured: true,
        isOnSale: false,
        isNewArrival: false,
      },
      {
        id: 2,
        name: 'ASUS ROG Ally (Z1 Extreme)',
        description: 'High-end handheld gaming PC featuring an AMD Ryzen Z1 Extreme processor, 120Hz 7-inch display, and Windows 11 for AAA gaming on the go.',
        price: 699.99,
        originalPrice: 799.99,
        thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.IyUHxFkHEE-VH0HjKB86yAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
        stock: 10,
        categoryId: 1,
        averageRating: 4.30,
        reviewCount: 85,
        isFeatured: false,
        isOnSale: true,
        isNewArrival: true,
      },
      {
        id: 3,
        name: 'AYANEO 2 Handheld Gaming PC',
        description: 'Powerful handheld gaming PC with AMD Ryzen 7 processor, 16GB RAM, and a 7-inch 1920x1200 display for high-end portable gaming.',
        price: 1099.00,
        originalPrice: 1099.00,
        thumbnail: 'https://www.bigw.com.au/medias/sys_master/images/images/hf0/h3c/34752367722526.jpg',
        stock: 5,
        categoryId: 1,
        averageRating: 4.00,
        reviewCount: 32,
      },
      {
        id: 4,
        name: 'Nintendo Switch OLED Model',
        description: "Nintendo's hybrid console with a 7-inch vibrant OLED display, enhanced audio, and 64GB internal storage for both portable and docked play.",
        price: 349.99,
        originalPrice: 349.99,
        thumbnail: 'https://shop.urbanrepublic.com.my/cdn/shop/files/045496883386_1.jpg?v=1737358469&width=1426',
        stock: 50,
        categoryId: 1,
        averageRating: 4.80,
        reviewCount: 200,
        isFeatured: true,
      },
      {
        id: 5,
        name: 'Nintendo Switch Lite',
        description: 'Compact handheld-only version of the Nintendo Switch featuring integrated controls and a 5.5-inch screen, ideal for gaming on the go.',
        price: 199.99,
        originalPrice: 199.99,
        thumbnail: 'https://tse3.mm.bing.net/th/id/OIP.UAp7HAPQu5GQwXk4cCwWNwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
        stock: 40,
        categoryId: 1,
        averageRating: 4.70,
        reviewCount: 180,
      },
      {
        id: 6,
        name: 'Logitech G Cloud Gaming Handheld',
        description: 'Cloud gaming handheld with 7-inch Full HD touchscreen, precision controls, and up to 12-hour battery life for streaming Xbox, Steam Link, and more.',
        price: 299.99,
        originalPrice: 349.99,
        thumbnail: 'https://media.karousell.com/media/photos/products/2023/9/14/ayn_odin_lite_1694698217_4ac3bd3f.jpg',
        stock: 20,
        categoryId: 1,
        averageRating: 4.20,
        reviewCount: 60,
        isOnSale: true,
      },
      {
        id: 8,
        name: 'Xbox Series X|S Wireless Controller',
        description: 'Official Xbox Wireless Controller (Carbon Black) featuring textured grips, hybrid D-pad, and Bluetooth connectivity for Xbox Series X|S, Xbox One, and PC.',
        price: 59.99,
        originalPrice: 59.99,
        thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.EZS9i6-t1NlCxXz3NRibBQHaH7?r=0&w=800&h=857&rs=1&pid=ImgDetMain&o=7&rm=3',
        stock: 100,
        categoryId: 2,
        averageRating: 4.60,
        reviewCount: 150,
      },
      {
        id: 9,
        name: 'Sony DualSense Wireless Controller (PS5)',
        description: 'PlayStation 5 DualSense controller with adaptive triggers, haptic feedback, built-in microphone, and signature two-tone design for immersive gaming.',
        price: 69.99,
        originalPrice: 69.99,
        thumbnail: 'https://cdn.grupoelcorteingles.es/SGFM/dctm/MEDIA03/202311/16/00194481001025____5__1200x1200.jpg',
        stock: 80,
        categoryId: 2,
        averageRating: 4.70,
        reviewCount: 160,
      },
      {
        id: 10,
        name: 'Nintendo Switch Pro Controller',
        description: 'Ergonomic wireless controller for the Nintendo Switch featuring motion controls, HD rumble, and amiibo NFC support, offering a traditional gamepad feel.',
        price: 69.99,
        originalPrice: 79.99,
        thumbnail: 'https://phonesstorekenya.com/wp-content/uploads/2023/12/Nintendo-Switch-Pro-Controller1.jpg',
        stock: 60,
        categoryId: 2,
        averageRating: 4.80,
        reviewCount: 90,
        isOnSale: true,
      },
      {
        id: 11,
        name: 'Logitech G29 Driving Force Racing Wheel',
        description: 'Force feedback racing wheel and pedals set with dual-motor feedback, 900° rotation, and leather-wrapped wheel, compatible with PS5, PS4, and PC for realistic racing.',
        price: 299.99,
        originalPrice: 349.99,
        thumbnail: 'https://coolboxpe.vtexassets.com/arquivos/ids/274826-800-auto?v=638210770389200000&width=800&height=auto&aspect=true',
        stock: 15,
        categoryId: 2,
        averageRating: 4.50,
        reviewCount: 50,
        isFeatured: true,
        isOnSale: true,
      },
      {
        id: 15,
        name: 'Razer DeathAdder V2 Gaming Mouse',
        description: 'Ergonomic wired gaming mouse with a 20,000 DPI optical sensor, Razer Chroma RGB lighting, and 8 programmable buttons for precision and comfort.',
        price: 69.99,
        originalPrice: 79.99,
        thumbnail: 'https://www.jbhifi.com.au/cdn/shop/products/520525-Product-1-I-637581546089131828_1024x1024.jpg',
        stock: 45,
        categoryId: 3,
        averageRating: 4.70,
        reviewCount: 150,
        isOnSale: true,
        isNewArrival: true,
      },
      {
        id: 16,
        name: 'SteelSeries Rival 600 Gaming Mouse',
        description: 'Dual sensor RGB gaming mouse offering true 1-to-1 tracking (up to 12,000 CPI) and customizable weight system for balanced, precise gameplay.',
        price: 79.99,
        originalPrice: 79.99,
        thumbnail: 'https://www.gamernecessary.com/wp-content/uploads/2020/07/SteelSeries-Rival-600-Appearance.jpg',
        stock: 60,
        categoryId: 3,
        averageRating: 4.50,
        reviewCount: 110,
      },
      {
        id: 17,
        name: 'Corsair Ironclaw RGB Gaming Mouse',
        description: 'Ergonomic FPS/MOBA gaming mouse with a 18,000 DPI optical sensor, dynamic RGB lighting, and seven programmable buttons for big-handed gamers.',
        price: 59.99,
        originalPrice: 69.99,
        thumbnail: 'https://tse4.mm.bing.net/th/id/OIP.sk-kdfU6k-iwvZILiXokJAHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
        stock: 25,
        categoryId: 3,
        averageRating: 4.40,
        reviewCount: 70,
        isOnSale: true,
      },
      {
        id: 18,
        name: 'Glorious Model O RGB Gaming Mouse',
        description: 'Ultra-lightweight honeycomb shell gaming mouse (67g) with a 12,000 DPI optical sensor, RGB lighting, and flexible Ascended Cord for competitive play.',
        price: 49.99,
        originalPrice: 59.99,
        thumbnail: 'https://c1.neweggimages.com/ProductImageCompressAll1280/AXU8D2107090OAM1.jpg',
        stock: 30,
        categoryId: 3,
        averageRating: 4.60,
        reviewCount: 80,
        isOnSale: true,
      },
      {
        id: 19,
        name: 'HyperX Pulsefire Surge Gaming Mouse',
        description: 'RGB gaming mouse with a 16,000 DPI Pixart sensor, 360° light ring, and Omron switches, delivering accuracy and style for any gaming setup.',
        price: 39.99,
        originalPrice: 39.99,
        thumbnail: 'https://uk.hyperx.com/cdn/shop/products/hyperx_pulsefire_surge_2_angled_back.jpg?v=1662988388',
        stock: 50,
        categoryId: 3,
        averageRating: 4.30,
        reviewCount: 60,
      },
      {
        id: 20,
        name: 'SteelSeries QcK Prism XL RGB Mouse Pad',
        description: 'Extra-large gaming mousepad with dual-zone RGB illumination and a micro-woven cloth surface for smooth, consistent mouse glide and style.',
        price: 59.99,
        originalPrice: 59.99,
        thumbnail: 'https://files.pccasegear.com/images/1613359085-SS-63511-thb.jpg',
        stock: 70,
        categoryId: 4,
        averageRating: 4.80,
        reviewCount: 50,
      },
      {
        id: 21,
        name: 'Corsair ST100 RGB Headset Stand',
        description: 'Premium headset stand with built-in 2-port USB 3.1 hub and RGB lighting powered by Corsair iCUE, providing stylish storage and connectivity for your headphones.',
        price: 69.99,
        originalPrice: 79.99,
        thumbnail: 'https://e.allegroimg.com/s1024/0c11d2/35a3d28a41bc8ed8d54b9d6f48be',
        stock: 25,
        categoryId: 4,
        averageRating: 4.50,
        reviewCount: 30,
        isFeatured: true,
        isOnSale: true,
      },
      {
        id: 22,
        name: 'Govee RGB LED Light Strip (5m)',
        description: '5-meter smart RGB LED light strip kit with adhesive backing and millions of color options, perfect for enhancing gaming setups or room ambience.',
        price: 29.99,
        originalPrice: 29.99,
        thumbnail: 'https://www.proshop.dk/Images/915x900/3129559_fb4cda94db98.jpg',
        stock: 100,
        categoryId: 4,
        averageRating: 4.40,
        reviewCount: 90,
      },
      {
        id: 23,
        name: 'PlayStation 5 DualSense Charging Station',
        description: 'Official charging dock for up to two DualSense controllers, providing quick and convenient charging without needing to connect to the PS5 console.',
        price: 29.99,
        originalPrice: 29.99,
        thumbnail: 'https://i0.wp.com/nextlevelgamingstore.com/wp-content/uploads/2020/11/Cargador-de-carga-r-pida-para-PS5-estaci-n-de-acoplamiento-de-carga-r-pida-con.jpg?w=1000&ssl=1',
        stock: 40,
        categoryId: 4,
        averageRating: 4.90,
        reviewCount: 120,
        isFeatured: true,
        isNewArrival: true,
      },
      {
        id: 24,
        name: 'Gunnar Intercept Blue Light Glasses',
        description: 'Gaming eyewear with amber-tinted lenses that filter blue light and reduce eye strain during extended gaming or computer use.',
        price: 49.99,
        originalPrice: 59.99,
        thumbnail: 'https://cdn-s3.touchofmodern.com/products/002/720/197/1e086a6e8992e6832a870b7e078bed1e_large.jpg?1701979096',
        stock: 10,
        categoryId: 4,
        averageRating: 4.20,
        reviewCount: 15,
        isFeatured: true,
        isOnSale: true,
        isNewArrival: true,
      },
      {
        id: 25,
        name: 'Razer Mouse Bungee v2',
        description: 'Cable management accessory that holds your wired mouse cable in place with a spring arm to eliminate cable drag and improve swipes during gameplay.',
        price: 19.99,
        originalPrice: 19.99,
        thumbnail: 'https://static0.makeuseofimages.com/wordpress/wp-content/uploads/2022/11/razer-mouse-bungee-v2.jpg',
        stock: 35,
        categoryId: 4,
        averageRating: 4.30,
        reviewCount: 22,
      },
    ],
  })
  console.log('✅ Created 21 products')

  console.log('')
  console.log('🎉 Seeding completed successfully!')
  console.log('📊 Summary:')
  console.log('   - 5 categories')
  console.log('   - 4 users (1 admin)')
  console.log('   - 21 products')
  console.log('')
  console.log('🔐 Login credentials:')
  console.log('   Admin: admin01@nexusgear.com / 001222')
  console.log('   User:  rexxissmee@gmail.com / (original password)')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
