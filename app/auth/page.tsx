"use client"

import React from "react";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

function LoginButton({ loading, onError, btnId }: { loading: boolean, onError: (err: any) => void, btnId?: string }) {
  const [btnLoading, setBtnLoading] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setBtnLoading(true);
    onError("");

    const email = (document.getElementById('loginEmail') as HTMLInputElement)?.value.trim();
    const password = (document.getElementById('loginPassword') as HTMLInputElement)?.value;

    const payload = { email, password };

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.error)) {
          toast({
            title: "Login Failed",
            description: data.error[0] || "Please check your credentials and try again.",
            variant: "destructive",
            className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
          });
          onError(data.error[0]);
        } else {
          toast({
            title: "Login Failed",
            description: data.error || 'Login failed',
            variant: "destructive",
            className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
          });
          onError(data.error || 'Login failed');
        }
      } else {
        localStorage.setItem('user', JSON.stringify(data.user));
        login({
          id: data.user.id,
          first_name: data.user.first_name ?? null,
          last_name: data.user.last_name ?? null,
          email: data.user.email,
          phone: data.user.phone ?? null,
          date_of_birth: data.user.date_of_birth ?? null,
          gender: data.user.gender ?? null,
          role: data.user.role,
          address_street: data.user.address_street ?? null,
          address_ward: data.user.address_ward ?? null,
          address_city: data.user.address_city ?? null,
          address_country: data.user.address_country ?? null,
          created_at: data.user.created_at ?? null,
          updated_at: data.user.updated_at ?? null,
        }, data.sessionId, data.expiresAt);
        toast({
          title: "Login Successful",
          description: "Discover exclusive offers now!",
          variant: "default",
          className: "bg-green-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
        });
        setTimeout(() => {
          if (data.user.role === 'admin') {
            router.push("/admin");
          } else {
            router.push("/");
          }
        }, 800);
      }
    } catch (err) {
      toast({
        title: "Network Error",
        description: "Unable to connect to server.",
        variant: "destructive",
        className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
      });
      onError('Network error');
    }
    setBtnLoading(false);
  };

  return (
    <Button
      id={btnId}
      className="w-full h-9 md:h-10 gradient-btn-light dark:gradient-btn-dark text-white text-sm md:text-base"
      onClick={handleLogin}
      disabled={btnLoading || loading}
    >
      {btnLoading || loading ? 'Logging in...' : 'Login'}
    </Button>
  );
}

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)

  // RegisterButton component
  function RegisterButton({ loading, onError, onSuccess, btnId }: { loading: boolean, onError: (err: any) => void, onSuccess: (msg: string) => void, btnId?: string }) {
    const [btnLoading, setBtnLoading] = useState(false);
    const { toast } = useToast();

    const handleRegister = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setBtnLoading(true);
      onError(null);
      onSuccess("");

      // Get form values
      const firstName = (document.getElementById('firstName') as HTMLInputElement)?.value.trim();
      const lastName = (document.getElementById('lastName') as HTMLInputElement)?.value.trim();
      const email = (document.getElementById('email') as HTMLInputElement)?.value.trim();
      const phone = (document.getElementById('phone') as HTMLInputElement)?.value.trim();
      const password = (document.getElementById('newPassword') as HTMLInputElement)?.value;
      const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement)?.value;
      const agree = (document.getElementById('terms') as HTMLInputElement)?.checked;

      const payload = {
        firstName,
        lastName: lastName || "",
        email,
        phone,
        password,
        confirmPassword,
        agree,
      };

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (Array.isArray(data.error)) {
            toast({
              title: "Registration Failed",
              description: data.error[0] || "Please fill in all required fields.",
              variant: "destructive",
              className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
            });
            onError(data.error[0]);
          } else {
            toast({
              title: "Registration Failed",
              description: data.error || 'Registration failed',
              variant: "destructive",
              className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
            });
            onError(data.error || 'Registration failed');
          }
        } else {
          toast({
            title: "Registration Successful",
            description: "You can now log in to your account.",
            variant: "default",
            className: "bg-blue-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
          });
          onSuccess(data.message || 'Welcome! You can now log in.');
          setTimeout(() => {
            const loginTab = document.querySelector('[data-value="login"]');
            if (loginTab) (loginTab as HTMLElement).click();
            window.location.href = "/auth";
          }, 800);
        }
      } catch (err) {
        toast({
          title: "Network Error",
          description: "Unable to connect to server.",
          variant: "destructive",
          className: "bg-red-600 text-white border-none shadow-xl rounded-lg font-semibold text-base px-6 py-4"
        });
        onError('Network error');
      }
      setBtnLoading(false);
    };

    return (
      <Button
        id={btnId}
        className="w-full h-9 md:h-10 gradient-btn-light dark:gradient-btn-dark text-white text-sm md:text-base"
        onClick={handleRegister}
        disabled={btnLoading || loading}
      >
        {btnLoading || loading ? 'Registering...' : 'Register'}
      </Button>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center py-8 md:py-16 px-4">
      <div className="w-full max-w-sm sm:max-w-md">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8 h-10 md:h-11">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-blue-900/20">
              <CardHeader className="pb-4 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Login to your account</CardTitle>
                <CardDescription className="text-sm">
                  Enter your email and password to access your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 px-4 md:px-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="loginEmail" className="text-sm">
                    Email
                  </Label>
                  <Input id="loginEmail" type="email" placeholder="name@example.com" className="h-9 md:h-10" tabIndex={1}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        document.getElementById('loginPassword')?.focus();
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="loginPassword" className="text-sm">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="loginPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-9 md:h-10 pr-10"
                      tabIndex={2}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          document.getElementById('loginBtn')?.click();
                          e.preventDefault();
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 md:h-10 w-9 md:w-10 px-2 md:px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="h-3.5 w-3.5 md:h-4 md:w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-600"
                    />
                    <Label htmlFor="remember" className="text-xs md:text-sm font-normal">
                      Remember me
                    </Label>
                  </div>
                  <Link href="#" className="text-xs md:text-sm text-blue-500 hover:text-blue-400">
                    Forgot password?
                  </Link>
                </div>
              </CardContent>
              <CardFooter className="px-4 md:px-6 pb-4 md:pb-6">
                <div className="space-y-3 w-full">
                  <LoginButton loading={false} onError={() => { }} btnId="loginBtn" />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-9 md:h-10 bg-transparent text-sm md:text-base"
                    type="button"
                  >
                    <svg className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card className="border-blue-900/20">
              <CardHeader className="pb-4 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Create an account</CardTitle>
                <CardDescription className="text-sm">Enter your details to create a new account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 px-4 md:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1.5 md:space-y-2">
                    <Label htmlFor="firstName" className="text-sm">
                      First name
                    </Label>
                    <Input id="firstName" placeholder="John" className="h-9 md:h-10" tabIndex={3}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          document.getElementById('lastName')?.focus();
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <Label htmlFor="lastName" className="text-sm">
                      Last name <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input id="lastName" placeholder="Doe" className="h-9 md:h-10" tabIndex={4}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          document.getElementById('email')?.focus();
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="email" className="text-sm">
                    Email
                  </Label>
                  <Input id="email" type="email" placeholder="name@example.com" className="h-9 md:h-10" tabIndex={5}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        document.getElementById('phone')?.focus();
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="phone" className="text-sm">
                    Phone Number
                  </Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" className="h-9 md:h-10" tabIndex={6}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        document.getElementById('newPassword')?.focus();
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="newPassword" className="text-sm">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-9 md:h-10 pr-10"
                      tabIndex={7}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          document.getElementById('confirmPassword')?.focus();
                          e.preventDefault();
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 md:h-10 w-9 md:w-10 px-2 md:px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm">
                    Confirm Password
                  </Label>
                  <Input id="confirmPassword" type="password" placeholder="••••••••" className="h-9 md:h-10" tabIndex={8}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        document.getElementById('registerBtn')?.click();
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="terms"
                    className="h-3.5 w-3.5 md:h-4 md:w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-600 mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-xs md:text-sm font-normal leading-relaxed">
                    I agree to the{" "}
                    <Link href="/policy" className="text-blue-500 hover:text-blue-400">
                      terms of service
                    </Link>{" "}
                    and{" "}
                    <Link href="/policy" className="text-blue-500 hover:text-blue-400">
                      privacy policy
                    </Link>
                  </Label>
                </div>
              </CardContent>
              <CardFooter className="px-4 md:px-6 pb-4 md:pb-6">
                <div className="space-y-3 w-full">
                  {/* Register form submit handler */}
                  <RegisterButton
                    loading={registerLoading}
                    onError={setRegisterError}
                    onSuccess={setRegisterSuccess}
                    btnId="registerBtn"
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-9 md:h-10 bg-transparent text-sm md:text-base"
                    type="button"
                  >
                    <svg className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign up with Google
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
