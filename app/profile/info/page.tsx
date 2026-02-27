"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Mail, Phone, MapPin, Calendar } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import Link from "next/link"

export default function ProfileInfoPage() {
  const user = useAuthStore((state) => state.user);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Information</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View your account details</p>
        </div>
        <div className="flex gap-2">
          <Link href="/profile/edit">
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-icon lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : 'User'}</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {user?.role === 'admin' ? 'Administrator' : 'Premium Member'}
                </p>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 mt-1">
                  Verified Account
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                  <p className="text-gray-900 dark:text-white font-medium">{user?.first_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                  <p className="text-gray-900 dark:text-white font-medium">{user?.last_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</label>
                  <p className="text-gray-900 dark:text-white font-medium">{user?.date_of_birth || '-'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</label>
                  <p className="text-gray-900 dark:text-white font-medium">{user?.gender || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</label>
                  <p className="text-gray-900 dark:text-white font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Status</label> <br />
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium">{user?.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium">{user?.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                <p className="font-medium">
                  {user?.address_city || '-'}{user?.address_city && user?.address_country ? ', ' : ''}{user?.address_country || ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                <p className="font-medium">Recently</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Account Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">12</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">$1,249.87</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">8</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Wishlist Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">3</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Saved Addresses</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
