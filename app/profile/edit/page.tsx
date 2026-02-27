"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Upload } from "lucide-react"

export default function EditProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address_street: "",
    address_ward: "",
    address_city: "",
    address_country: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
        date_of_birth: user.date_of_birth || "",
        gender: user.gender || "",
        address_street: user.address_street || "",
        address_ward: user.address_ward || "",
        address_city: user.address_city || "",
        address_country: user.address_country || "",
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, id: user?.id }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        login(data.user); // update auth store
        toast({
          title: "Profile updated!",
          description: "Your profile information has been updated successfully.",
          variant: "default",
          className: "bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
        });
        setTimeout(() => router.push("/profile/info"), 1200);
      } else {
        toast({
          title: "Update failed",
          description: data.error ? data.error.join("\n") : "Update failed",
          variant: "destructive",
          className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
        });
      }
    } catch (err) {
      toast({
        title: "Update failed",
        description: "Could not update profile. Please try again later.",
        variant: "destructive",
        className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Update your account information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-icon lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
              </div>
              <div>
                <Button type="button" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Picture
                </Button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">JPG, PNG or GIF. Max size 2MB.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(value) => handleSelectChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              {/* <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={3}
                placeholder="Tell us about yourself..."
              /> */}
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address_street">Street Address</Label>
              <Input id="address_street" name="address_street" value={formData.address_street} onChange={handleInputChange} placeholder="123 Main St" />
            </div>
            <div>
              <Label htmlFor="address_ward">Ward / District</Label>
              <Input id="address_ward" name="address_ward" value={formData.address_ward} onChange={handleInputChange} placeholder="Ward 1, District 1" />
            </div>
            <div>
              <Label htmlFor="address_city">City / Province</Label>
              <Input id="address_city" name="address_city" value={formData.address_city} onChange={handleInputChange} placeholder="Ho Chi Minh City" />
            </div>
            <div>
              <Label htmlFor="address_country">Country</Label>
              <Input id="address_country" name="address_country" value={formData.address_country} onChange={handleInputChange} placeholder="Vietnam" />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.push("/profile/info")}>Cancel</Button>
          <Button type="submit" className="gradient-btn-light dark:gradient-btn-dark text-white">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
