'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  const handleSignUp = async () => {
    if (!email || !password) return alert('Please enter both email and password')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { alert(`Signup Error: ${error.message}`); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('User not found after signup'); setLoading(false); return }
      const { error: profileError } = await supabase.from('profiles').insert([{ id: user.id, email: user.email }])
      if (profileError) { console.log(profileError); alert('Profile creation failed') }
      else { alert('Account created! Redirecting...'); router.push('/dashboard') }
    } catch (err) {
      alert('Network error. Check connection.')
    }
    setLoading(false)
  }

  const handleLogin = async () => {
    if (!email || !password) return alert('Please enter both email and password')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { alert(`Login Error: ${error.message}`) }
      else { alert('Login successful! Redirecting...'); router.push('/dashboard') }
    } catch (err) {
      alert('Network error. Check connection.')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .v-root {
          min-height: 100vh;
          background: #080a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .v-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%);
          pointer-events: none;
        }

        .v-root::after {
          content: '';
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .v-panel {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 10;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)'};
          transition: opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }

        .v-statusbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 1rem 0;
        }

        .v-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .v-brand-icon {
          width: 24px;
          height: 24px;
          background: #3b82f6;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .v-brand-icon svg { width: 14px; height: 14px; }

        .v-brand-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.01em;
        }

        .v-status-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.6rem;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 999px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #4ade80;
          letter-spacing: 0.05em;
        }

        .v-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #4ade80;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .v-card {
          background: rgba(13, 16, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .v-card-inner { padding: 1.75rem; }

        .v-breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 1.5rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.25);
        }

        .v-breadcrumb-active { color: #3b82f6; }

        .v-heading {
          font-size: 1.35rem;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.025em;
          line-height: 1.3;
          margin-bottom: 0.35rem;
        }

        .v-subheading {
          font-size: 0.8rem;
          font-weight: 300;
          color: rgba(255,255,255,0.35);
          margin-bottom: 1.5rem;
        }

        .v-divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 1.25rem 0;
        }

        .v-input-wrap { margin-bottom: 0.75rem; }

        .v-input-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }

        .v-input {
          width: 100%;
          padding: 0.7rem 0.9rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 7px;
          color: #f1f5f9;
          font-family: 'Outfit', sans-serif;
          font-size: 0.88rem;
          font-weight: 400;
          outline: none;
          transition: all 0.15s ease;
        }

        .v-input::placeholder { color: rgba(255,255,255,0.18); }

        .v-input:focus {
          border-color: rgba(59,130,246,0.5);
          background: rgba(59,130,246,0.04);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
        }

        .v-btn {
          width: 100%;
          padding: 0.72rem 1.25rem;
          border-radius: 7px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.83rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          margin-bottom: 0.6rem;
        }

        .v-btn:last-child { margin-bottom: 0; }

        .v-btn-primary {
          background: #3b82f6;
          border: 1px solid #3b82f6;
          color: #fff;
        }

        .v-btn-primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(59,130,246,0.35);
        }

        .v-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .v-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        .v-btn-ghost {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.35);
        }

        .v-btn-ghost:hover:not(:disabled) {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.6);
        }

        .v-btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }

        .v-card-footer {
          padding: 0.75rem 1.75rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.015);
        }

        .v-footer-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.04em;
        }

        .v-footer-version {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem;
          color: rgba(59,130,246,0.5);
          letter-spacing: 0.04em;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .v-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
      `}</style>

      <div className="v-root">
        <div className="v-panel">

          {/* Top bar */}
          <div className="v-statusbar">
            <div className="v-brand">
              <div className="v-brand-icon">
                <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 7L5.5 3.5L9 7L5.5 10.5L2 7Z" fill="white" fillOpacity="0.9"/>
                  <path d="M7 7L10.5 3.5L13 6L10.5 8.5L7 7Z" fill="white" fillOpacity="0.5"/>
                </svg>
              </div>
              <span className="v-brand-name">Vouch</span>
            </div>
            <div className="v-status-pill">
              <div className="v-status-dot" />
              SYSTEM ONLINE
            </div>
          </div>

          {/* Card */}
          <div className="v-card">
            <div className="v-card-inner">

              <div className="v-breadcrumb">
                <span>vouch</span>
                <span>/</span>
                <span className="v-breadcrumb-active">auth</span>
              </div>

              <div className="v-heading">Welcome back.</div>
              <div className="v-subheading">Sign in to your workspace or create a new account.</div>

              <div className="v-input-wrap">
                <label className="v-input-label">Email Address</label>
                <input
                  type="email"
                  className="v-input"
                  placeholder="name@university.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="v-input-wrap">
                <label className="v-input-label">Password</label>
                <input
                  type="password"
                  className="v-input"
                  placeholder="Min. 6 characters"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <div className="v-divider" />

              <button className="v-btn v-btn-primary" onClick={handleLogin} disabled={loading}>
                {loading ? <div className="v-spinner" /> : <>Sign In →</>}
              </button>

              <button className="v-btn v-btn-ghost" onClick={handleSignUp} disabled={loading}>
                {loading ? <div className="v-spinner" /> : 'Create New Account'}
              </button>

            </div>

            <div className="v-card-footer">
              <span className="v-footer-text">vouch.app / auth</span>
              <span className="v-footer-version">v1.0.0</span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
