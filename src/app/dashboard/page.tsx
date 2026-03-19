'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
 
export default function Dashboard() {
  const [view, setView] = useState<'selection' | 'create' | 'join'>('selection')
  const [projectName, setProjectName] = useState('')
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
 
  useEffect(() => { setMounted(true) }, [])
 
  const handleCreateProject = async () => {
    if (!projectName) return alert("Please type a project name first!")
    setLoading(true)
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error("Could not find logged-in user")
      const { error: insertError } = await supabase
        .from('projects')
        .insert([{ name: projectName, invite_code: inviteCode, creator_id: userData.user.id }])
      if (insertError) throw insertError
      alert(`SUCCESS! Your Project Code is: ${inviteCode}`)
      setView('selection')
      setProjectName('')
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }
 
  const handleJoinProject = async () => {
    if (!inviteCodeInput) return alert("Please enter a code")
    setLoading(true)
    try {
      const { data: project, error: findError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('invite_code', inviteCodeInput.toUpperCase())
        .single()
      if (!project) throw new Error("Invalid Code! Project not found.")
      const { data: userData } = await supabase.auth.getUser()
      const { error: joinError } = await supabase
        .from('members')
        .insert([{ project_id: project.id, user_id: userData.user?.id, email: userData.user?.email }])
      if (joinError) throw joinError
      alert(`Successfully joined: ${project.name}`)
      setView('selection')
      setInviteCodeInput('')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
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
 
        .v-option {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          cursor: pointer;
          background: rgba(255,255,255,0.02);
          transition: all 0.15s ease;
          margin-bottom: 0.6rem;
          width: 100%;
          text-align: left;
        }
 
        .v-option:last-child { margin-bottom: 0; }
 
        .v-option:hover {
          background: rgba(59,130,246,0.07);
          border-color: rgba(59,130,246,0.25);
        }
 
        .v-option:hover .v-option-icon {
          background: rgba(59,130,246,0.2);
          border-color: rgba(59,130,246,0.4);
          color: #3b82f6;
        }
 
        .v-option:hover .v-option-arrow {
          color: #3b82f6;
          transform: translateX(2px);
        }
 
        .v-option-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
          color: rgba(255,255,255,0.4);
        }
 
        .v-option-icon svg { width: 16px; height: 16px; }
 
        .v-option-text { flex: 1; }
 
        .v-option-label {
          display: block;
          font-size: 0.88rem;
          font-weight: 500;
          color: #e2e8f0;
          margin-bottom: 0.1rem;
        }
 
        .v-option-desc {
          display: block;
          font-size: 0.73rem;
          color: rgba(255,255,255,0.3);
          font-weight: 300;
        }
 
        .v-option-arrow {
          color: rgba(255,255,255,0.2);
          font-size: 0.8rem;
          transition: all 0.15s ease;
          flex-shrink: 0;
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
 
        .v-input.mono {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.2rem;
          letter-spacing: 0.25em;
          text-align: center;
          text-transform: uppercase;
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
 
        .v-btn-ghost:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.6);
        }
 
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
 
        .v-view {
          animation: viewIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards;
        }
 
        @keyframes viewIn {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
 
      <div className="v-root">
        <div className="v-panel">
 
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
 
          <div className="v-card">
            <div className="v-card-inner">
 
              <div className="v-breadcrumb">
                <span>vouch</span>
                <span>/</span>
                <span className="v-breadcrumb-active">
                  {view === 'selection' ? 'dashboard' : view === 'create' ? 'create' : 'join'}
                </span>
              </div>
 
              {view === 'selection' && (
                <div className="v-view">
                  <div className="v-heading">Good to see you.</div>
                  <div className="v-subheading">Select how you'd like to proceed.</div>
 
                  <button className="v-option" onClick={() => setView('create')}>
                    <div className="v-option-icon">
                      <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M11.5 9v6M8.5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                    <div className="v-option-text">
                      <span className="v-option-label">Project Lead</span>
                      <span className="v-option-desc">Spin up a project, generate an invite code</span>
                    </div>
                    <span className="v-option-arrow">›</span>
                  </button>
 
                  <button className="v-option" onClick={() => setView('join')}>
                    <div className="v-option-icon">
                      <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                    <div className="v-option-text">
                      <span className="v-option-label">Team Member</span>
                      <span className="v-option-desc">Enter a code and join your team's workspace</span>
                    </div>
                    <span className="v-option-arrow">›</span>
                  </button>
                </div>
              )}
 
              {view === 'create' && (
                <div className="v-view">
                  <div className="v-heading">New Project</div>
                  <div className="v-subheading">Name it. We'll handle the rest.</div>
 
                  <div className="v-input-wrap">
                    <label className="v-input-label">Project Name</label>
                    <input
                      className="v-input"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      placeholder="e.g. apollo-v2"
                      autoFocus
                    />
                  </div>
 
                  <div className="v-divider" />
 
                  <button className="v-btn v-btn-primary" onClick={handleCreateProject} disabled={loading}>
                    {loading ? <div className="v-spinner" /> : <>Generate Invite Code →</>}
                  </button>
                  <button className="v-btn v-btn-ghost" onClick={() => setView('selection')}>← Back</button>
                </div>
              )}
 
              {view === 'join' && (
                <div className="v-view">
                  <div className="v-heading">Join a Project</div>
                  <div className="v-subheading">Paste the 6-character code from your lead.</div>
 
                  <div className="v-input-wrap">
                    <label className="v-input-label">Invite Code</label>
                    <input
                      className="v-input mono"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinProject()}
                      placeholder="ABC123"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
 
                  <div className="v-divider" />
 
                  <button className="v-btn v-btn-primary" onClick={handleJoinProject} disabled={loading}>
                    {loading ? <div className="v-spinner" /> : <>Verify & Join →</>}
                  </button>
                  <button className="v-btn v-btn-ghost" onClick={() => setView('selection')}>← Back</button>
                </div>
              )}
 
            </div>
 
            <div className="v-card-footer">
              <span className="v-footer-text">vouch.app / workspace</span>
              <span className="v-footer-version">v1.0.0</span>
            </div>
          </div>
 
        </div>
      </div>
    </>
  )
}
// O90DCS
