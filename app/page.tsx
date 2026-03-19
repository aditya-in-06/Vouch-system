'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // SIGN UP
  const handleSignUp = async () => {
    if (!email || !password) {
      alert('Please enter both email and password')
      return
    }

    setLoading(true)

    try {
      // Step 1: Create user
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        alert(`Signup Error: ${error.message}`)
        setLoading(false)
        return
      }

      // Step 2: Get logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('User not found after signup')
        setLoading(false)
        return
      }

      // Step 3: Insert into profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            email: user.email,
          },
        ])

      if (profileError) {
        console.log(profileError)
        alert('Profile creation failed')
      } else {
        alert('Signup + profile created successfully!')
      }
    } catch (err) {
      alert('Network error. Check connection.')
    }

    setLoading(false)
  }

  // LOGIN
  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please enter both email and password')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        alert(`Login Error: ${error.message}`)
      } else {
        alert('Login successful!')
      }
    } catch (err) {
      alert('Network error. Check connection.')
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 space-y-8">
        
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-blue-600">Vouch</h1>
          <p className="text-gray-500 mt-2">Project Accountability System</p>
        </div>

        <div className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@university.com"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Min. 6 characters"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

        </div>

        <div className="flex flex-col gap-3">
          
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold p-3 rounded-xl hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Login'}
          </button>

          <button
            onClick={handleSignUp}
            disabled={loading}
            className="w-full bg-white border-2 border-blue-600 text-blue-600 font-semibold p-3 rounded-xl hover:bg-blue-50"
          >
            Create New Account
          </button>

        </div>

        <p className="text-xs text-center text-gray-400">
          Turn OFF "Confirm Email" in Supabase for testing.
        </p>

      </div>
    </div>
  )
}
