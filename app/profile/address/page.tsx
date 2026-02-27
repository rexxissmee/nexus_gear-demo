"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MapPin } from "lucide-react"

export default function SavedAddressPage() {
  const [addresses] = useState([
    {
      id: 1,
      type: "Home",
      name: "John Doe",
      address_street: "123 Gaming Street",
      address_ward: "Ward 1",
      address_city: "New York",
      address_country: "United States",
      phone: "+1 (555) 123-4567",
      isDefault: true,
    },
    {
      id: 2,
      type: "Work",
      name: "John Doe",
      address_street: "456 Tech Avenue",
      address_ward: "Ward 5",
      address_city: "New York",
      address_country: "United States",
      phone: "+1 (555) 123-4567",
      isDefault: false,
    },
    {
      id: 3,
      type: "Other",
      name: "John Doe",
      address_street: "789 Gaming Plaza",
      address_ward: "Ward 3",
      address_city: "Los Angeles",
      address_country: "United States",
      phone: "+1 (555) 987-6543",
      isDefault: false,
    },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Addresses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your delivery addresses</p>
        </div>
        <Button className="gradient-btn-light dark:gradient-btn-dark text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add New Address
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {addresses.map((address) => (
          <Card key={address.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <CardTitle className="text-lg">{address.type}</CardTitle>
                </div>
                {address.isDefault && (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Default</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{address.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{address.phone}</p>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>{address.address_street}</p>
                <p>{address.address_ward}</p>
                <p>
                  {address.address_city}
                  {address.address_city && address.address_country ? ', ' : ''}
                  {address.address_country}
                </p>
              </div>

              <div className="flex space-x-2 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 bg-transparent">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>

              {!address.isDefault && (
                <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700">
                  Set as Default
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add New Address Card */}
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer">
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <Plus className="h-8 w-8 text-gray-400 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">Add New Address</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Add a new delivery address to your account</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
