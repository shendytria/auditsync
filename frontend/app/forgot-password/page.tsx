'use client'

import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false) // Tambahan untuk kontrol warna
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const res = await fetch('/api/v1/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengirim email')
      }

      setMessage('Link reset password sudah dikirim ke email kamu.')
      setIsError(false)
    } catch (err: any) {
      setMessage(err.message)
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <form onSubmit={handleSubmit} className="p-6 bg-white shadow-md rounded w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-center">Lupa Password</h2>
        <p className="text-sm text-gray-600 text-center">
          Masukkan email terdaftar untuk menerima link reset password.
        </p>

        <div>
          <label className="text-sm font-medium block mb-1">Email</label>
          <input
            type="email"
            placeholder="contoh@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? 'Sedang Mengirim...' : 'Kirim Link Reset'}
        </button>

        {message && (
          <p className={`text-sm text-center ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </main>
  )
}