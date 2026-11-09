'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()

  const API_LOGIN_URL =
    process.env.NEXT_PUBLIC_API_LOGIN_URL ||
    '/api/v1/login'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Prevent multiple submit
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(API_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      let data: any = null

      try {
        data = await response.json()
      } catch {
        throw new Error(
          'Server tidak memberikan response yang valid.'
        )
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Login gagal, periksa username dan password.'
        )
      }

      // Validate response structure
      if (
        !data?.token ||
        !data?.user ||
        !data.user.id ||
        !data.user.nama_lengkap ||
        !data.user.role ||
        !data.user.username ||
        !data.user.email
      ) {
        throw new Error(
          'Format data user dari server tidak sesuai.'
        )
      }

      const userForStore = {
        id: data.user.id,
        fullName: data.user.nama_lengkap,
        role: data.user.role,
        username: data.user.username,
        email: data.user.email,
      }

      // Store token securely
      localStorage.setItem('token', data.token)

      // Store user data
      localStorage.setItem(
        'user_data',
        JSON.stringify(data.user)
      )

      const isDefault =
        data.user.is_default_password ?? false

      // Zustand State Update
      useAuthStore
        .getState()
        .login(userForStore, data.token, isDefault)

      // Clear sensitive state before redirect
      setPassword('')

      // Redirect with full page navigation so internal CSP (style-src 'unsafe-inline') is loaded
      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error('Login Error:', err)

      setError(
        err?.message ||
          'Terjadi kesalahan saat login.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  return (
    <main className="flex items-center justify-center w-full min-h-screen px-4 py-12">
      <div className="w-full max-w-md p-8 space-y-4 bg-putih rounded shadow-xl">
        
        <div className="flex justify-center mb-4">
          <img
            src="/logoOnly.png"
            alt="Logo E-Audit"
            width={60}
            height={153}
            className="w-[60px] h-auto"
          />
        </div>

        <h1 className="text-3xl font-bold text-center text-hitam">
          Selamat Datang
        </h1>

        <p className="text-sm text-center text-grey">
          Silakan masuk ke akun Anda
        </p>

        <form
          onSubmit={handleSubmit}
          method="POST"
          autoComplete="off"
          className="space-y-5 pt-4"
        >
          <div>
            <label
              htmlFor="username"
              className="block mb-1 text-sm font-medium text-hitam/80"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              disabled={isLoading}
              maxLength={100}
              className="w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 focus:ring-biru"
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block mb-1 text-sm font-medium text-hitam/80"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={
                  showPassword ? 'text' : 'password'
                }
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                disabled={isLoading}
                maxLength={200}
                className="w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 focus:ring-biru"
                placeholder="Masukkan password"
              />

              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grey"
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-center text-red-600">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 font-bold transition-opacity rounded text-putih bg-biru hover:bg-biru/90 disabled:opacity-70"
            >
              {isLoading
                ? 'Loading...'
                : 'Login'}
            </button>
          </div>
        </form>

        <div className="pt-2 text-center">
          <a
            href="/forgot-password"
            className="text-sm font-medium text-biru hover:underline"
          >
            Lupa Password?
          </a>
        </div>

        <div className="pt-4 mt-10 border-t border-gray-200">
          <p className="space-y-1 text-xs leading-relaxed text-center text-gray-500">
            <span className="block">
              © 2025 Quality System.
            </span>
            <span className="block">
              Developed by Vanesha Dhani.
            </span>
            <span className="block">
              All rights reserved.
            </span>
          </p>
        </div>
      </div>
    </main>
  )
}