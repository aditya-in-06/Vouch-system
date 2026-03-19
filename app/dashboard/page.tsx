
'use client'
import { useState } from 'react'

export default function Dashboard() {
  const [view, setView] = useState<'selection' | 'create' | 'join'>('selection')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        {view === 'selection' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Welcome to Vouch</h1>
            <p className="text-gray-500">How would you like to start?</p>
            <div className="grid gap-4">
              <button 
                onClick={() => setView('create')}
                className="p-6 border-2 border-blue-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition group text-left"
              >
                <h3 className="font-bold text-blue-600">I'm a Project Lead</h3>
                <p className="text-sm text-gray-500">Create a project and invite your team.</p>
              </button>
              <button 
                onClick={() => setView('join')}
                className="p-6 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition group text-left"
              >
                <h3 className="font-bold text-gray-800">I'm a Team Member</h3>
                <p className="text-sm text-gray-500">Join an existing project with an invite code.</p>
              </button>
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">New Project</h2>
            <input placeholder="Project Name (e.g. AI Chatbot)" className="w-full p-3 border rounded-xl" />
            <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">Generate Invite Code</button>
            <button onClick={() => setView('selection')} className="text-sm text-gray-400">Go Back</button>
          </div>
        )}

        {view === 'join' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Join Project</h2>
            <input placeholder="Enter 6-digit Invite Code" className="w-full p-3 border rounded-xl text-center text-xl tracking-widest" />
            <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">Join Team</button>
            <button onClick={() => setView('selection')} className="text-sm text-gray-400">Go Back</button>
          </div>
        )}
      </div>
    </div>
  )
}