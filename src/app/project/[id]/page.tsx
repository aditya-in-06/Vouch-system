'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient'

/* ───── types ───── */
type Project = { id: string; name: string; invite_code: string; creator_id: string }
type Member = { user_id: string; email: string }
type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  assigned_to: string | null
}
type TaskVouch = { task_id: string; voucher_user_id: string }
type MemberAnalytics = {
  user_id: string
  email: string
  assignedCount: number
  completedCount: number
  completedOnTimeCount: number
  vouchesReceived: number
  vouchesGiven: number
  reliabilityScore: number
}

type ActiveTab = 'overview' | 'tasks' | 'analytics'

function sameUserId(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim()
}

export default function ProjectHubPage() {
  const params = useParams<{ id: string }>()
  const projectId =
    typeof params?.id === 'string' ? params.id : (params?.id as string[] | undefined)?.[0] ?? ''
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskVouches, setTaskVouches] = useState<TaskVouch[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskLoading, setTaskLoading] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskAssignedTo, setTaskAssignedTo] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  /* ───── load data ───── */
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    const loadProjectData = async () => {
      if (!projectId) return
      setLoading(true)

      if (!supabaseConfigured) {
        alert('Supabase is not configured.')
        router.push('/')
        setLoading(false)
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        alert('Please log in first.')
        router.push('/')
        return
      }
      setCurrentUserId(userData.user.id)

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name, invite_code, creator_id')
        .eq('id', projectId)
        .single()

      if (projectError || !projectData) {
        alert('Project not found.')
        router.push('/dashboard')
        return
      }

      const { data: initialMemberRows, error: membersError } = await supabase
        .from('members')
        .select('user_id, email')
        .eq('project_id', projectId)

      let memberRows = initialMemberRows

      if (membersError) {
        alert(`Could not load members: ${membersError.message}`)
        setLoading(false)
        return
      }

      // Self-heal: creator row missing
      if (
        (!memberRows || memberRows.length === 0) &&
        sameUserId(projectData.creator_id, userData.user.id)
      ) {
        const { error: repairError } = await supabase.from('members').insert([
          { project_id: projectId, user_id: userData.user.id, email: userData.user.email ?? '' },
        ])
        const dup =
          !!repairError &&
          (repairError.code === '23505' || String(repairError.message).toLowerCase().includes('duplicate'))
        if (repairError && !dup) alert(`Could not add you to team: ${repairError.message}`)
        if (!repairError || dup) {
          const refetch = await supabase.from('members').select('user_id, email').eq('project_id', projectId)
          memberRows = refetch.data
        }
      }

      const { data: taskRows, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, assigned_to')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true })

      if (tasksError) {
        console.warn('Could not load tasks (table may not exist yet):', tasksError.message)
      }

      const { data: vouchRows, error: vouchesError } = await supabase
        .from('task_vouches')
        .select('task_id, voucher_user_id')
        .eq('project_id', projectId)

      if (vouchesError) {
        console.warn('Could not load vouches (table may not exist yet):', vouchesError.message)
      }

      setProject(projectData)
      // Deduplicate members by user_id to prevent duplicate React keys
      const uniqueMembers = Array.from(
        new Map((memberRows ?? []).map(m => [m.user_id, m])).values()
      )
      setMembers(uniqueMembers)
      setTasks(taskRows ?? [])
      setTaskVouches(vouchRows ?? [])
      setLoading(false)
    }

    loadProjectData()
    return () => cancelAnimationFrame(raf)
  }, [projectId, router])

  /* ───── computed ───── */
  const isLead = !!(project && currentUserId && sameUserId(project.creator_id, currentUserId))
  const memberEmailById = members.reduce<Record<string, string>>((acc, m) => { acc[m.user_id] = m.email; return acc }, {})

  /* ───── actions ───── */
  const refreshTasks = async () => {
    if (!projectId) return
    const { data: t } = await supabase.from('tasks').select('id, title, description, due_date, status, assigned_to').eq('project_id', projectId).order('due_date', { ascending: true })
    setTasks(t ?? [])
    const { data: v } = await supabase.from('task_vouches').select('task_id, voucher_user_id').eq('project_id', projectId)
    setTaskVouches(v ?? [])
  }

  const handleCreateTask = async () => {
    if (!isLead || !projectId) return
    if (!taskTitle.trim()) return alert('Task title is required.')
    if (!taskAssignedTo) return alert('Please assign the task to a member.')
    setTaskLoading(true)
    const { error } = await supabase.from('tasks').insert([{
      project_id: projectId,
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      due_date: taskDueDate || null,
      assigned_to: taskAssignedTo,
      status: 'pending',
    }])
    if (error) { alert(`Error: ${error.message}`); setTaskLoading(false); return }
    setTaskTitle(''); setTaskDescription(''); setTaskDueDate(''); setTaskAssignedTo('')
    setShowCreateForm(false)
    await refreshTasks()
    setTaskLoading(false)
  }

  const handleCompleteTask = async (taskId: string) => {
    if (!projectId) return
    setTaskLoading(true)
    const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId).eq('project_id', projectId)
    if (error) { alert(`Error: ${error.message}`); setTaskLoading(false); return }
    await refreshTasks()
    setTaskLoading(false)
  }

  const getTaskVouchCount = (taskId: string) => taskVouches.filter(v => v.task_id === taskId).length
  const hasCurrentUserVouched = (taskId: string) => {
    if (!currentUserId) return false
    return taskVouches.some(v => v.task_id === taskId && v.voucher_user_id === currentUserId)
  }

  const handleVouchTask = async (task: Task) => {
    if (!currentUserId || !projectId) return
    if (task.assigned_to === currentUserId) return alert('You cannot vouch for your own task.')
    if (task.status !== 'completed') return alert('Only completed tasks can be vouched.')
    if (hasCurrentUserVouched(task.id)) return alert('You already vouched for this task.')
    if (getTaskVouchCount(task.id) >= 2) return alert('This task already has enough vouches.')
    setTaskLoading(true)
    const { error } = await supabase.from('task_vouches').insert([{ project_id: projectId, task_id: task.id, voucher_user_id: currentUserId }])
    if (error) { alert(`Error: ${error.message}`); setTaskLoading(false); return }
    await refreshTasks()
    setTaskLoading(false)
  }

  const copyInviteCode = () => {
    if (project?.invite_code) {
      navigator.clipboard.writeText(project.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  /* ───── analytics ───── */
  const getMemberAnalytics = (): MemberAnalytics[] => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const vouchesByTask = taskVouches.reduce<Record<string, number>>((acc, v) => { acc[v.task_id] = (acc[v.task_id] ?? 0) + 1; return acc }, {})

    return members.map(member => {
      const assigned = tasks.filter(t => t.assigned_to === member.user_id)
      const completed = assigned.filter(t => t.status === 'completed')
      const onTime = completed.filter(t => !t.due_date || t.due_date >= todayISO)
      const vouchesReceived = completed.reduce((s, t) => s + (vouchesByTask[t.id] ?? 0), 0)
      const vouchesGiven = taskVouches.filter(v => v.voucher_user_id === member.user_id).length
      const assignedCount = assigned.length
      const completedCount = completed.length
      const completedOnTimeCount = onTime.length
      const onTimeRate = completedCount > 0 ? completedOnTimeCount / completedCount : 0
      const receiveRate = completedCount > 0 ? Math.min(vouchesReceived / (completedCount * 2), 1) : 0
      const giveRate = assignedCount > 0 ? Math.min(vouchesGiven / Math.max(assignedCount, 1), 1) : 0
      const reliabilityScore = Math.round(onTimeRate * 50 + receiveRate * 30 + giveRate * 20)
      return { user_id: member.user_id, email: member.email, assignedCount, completedCount, completedOnTimeCount, vouchesReceived, vouchesGiven, reliabilityScore }
    })
  }

  const analytics = getMemberAnalytics().sort((a, b) => b.reliabilityScore - a.reliabilityScore)
  const topPerformer = analytics[0]
  const laggingPerformer = analytics.length > 1 ? analytics[analytics.length - 1] : null

  /* ───── task counts ───── */
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const verifiedTasks = tasks.filter(t => t.status === 'completed' && getTaskVouchCount(t.id) >= 2)

  /* ───── initial helper ───── */
  const getInitial = (email: string) => email ? email.charAt(0).toUpperCase() : '?'
  const getAvatarColor = (email: string) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4']
    let hash = 0
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview', label: 'Overview',
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="1" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /></svg>,
    },
    {
      key: 'tasks', label: 'Tasks',
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h14M2 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      key: 'analytics', label: 'Analytics',
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="10" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="7" y="5" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="1" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>,
    },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ph-root {
          min-height: 100vh;
          background: #060810;
          font-family: 'Outfit', sans-serif;
          color: #e2e8f0;
          display: flex;
          position: relative;
          overflow: hidden;
        }
        .ph-root::before {
          content: '';
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
          pointer-events: none; z-index: 0;
        }
        .ph-root::after {
          content: '';
          position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 400px;
          background: radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 72%);
          pointer-events: none; z-index: 0;
        }

        /* ── sidebar ── */
        .ph-sidebar {
          width: 240px;
          min-height: 100vh;
          background: rgba(10,12,20,0.95);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          position: relative; z-index: 2;
          backdrop-filter: blur(20px);
          flex-shrink: 0;
        }
        .ph-sidebar-header {
          padding: 1.25rem 1.1rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .ph-brand-row {
          display: flex; align-items: center; gap: 0.55rem;
          margin-bottom: 0.9rem;
        }
        .ph-brand-icon {
          width: 28px; height: 28px; background: #3b82f6;
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
        }
        .ph-brand-icon svg { width: 16px; height: 16px; }
        .ph-brand-name {
          font-size: 0.95rem; font-weight: 600; color: #f1f5f9;
        }
        .ph-project-name {
          font-size: 0.8rem; color: rgba(255,255,255,0.4);
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.02em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ph-nav { padding: 0.75rem 0.6rem; flex: 1; }
        .ph-nav-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.6rem 0.7rem; border-radius: 8px;
          cursor: pointer; font-size: 0.85rem; font-weight: 400;
          color: rgba(255,255,255,0.45);
          transition: all 0.15s ease; margin-bottom: 0.2rem;
          border: 1px solid transparent;
          background: transparent;
          width: 100%; text-align: left;
        }
        .ph-nav-item:hover {
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.7);
        }
        .ph-nav-item.active {
          background: rgba(59,130,246,0.1);
          border-color: rgba(59,130,246,0.2);
          color: #60a5fa; font-weight: 500;
        }
        .ph-sidebar-footer {
          padding: 1rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .ph-role-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.2rem 0.55rem; border-radius: 999px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase;
        }
        .ph-role-lead {
          background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.25);
          color: #60a5fa;
        }
        .ph-role-member {
          background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.25);
          color: #a78bfa;
        }
        .ph-back-btn {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.45rem 0.65rem; border-radius: 7px;
          background: transparent; border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.4); font-size: 0.75rem;
          cursor: pointer; transition: all 0.15s ease;
          margin-top: 0.6rem; width: 100%;
          font-family: 'Outfit', sans-serif;
        }
        .ph-back-btn:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.65);
        }

        /* ── main content ── */
        .ph-main {
          flex: 1; min-height: 100vh; position: relative; z-index: 1;
          overflow-y: auto; padding: 2rem 2.5rem;
        }
        .ph-content {
          max-width: 820px; margin: 0 auto;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(12px)'};
          transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
        }

        /* page header */
        .ph-page-header { margin-bottom: 1.75rem; }
        .ph-page-title {
          font-size: 1.65rem; font-weight: 700; color: #f1f5f9;
          letter-spacing: -0.02em; margin-bottom: 0.25rem;
        }
        .ph-page-subtitle {
          font-size: 0.82rem; color: rgba(255,255,255,0.35);
          font-weight: 300;
        }

        /* ── cards ── */
        .ph-card {
          background: rgba(13,16,25,0.7);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 1.25rem;
          backdrop-filter: blur(16px);
          margin-bottom: 1rem;
          transition: border-color 0.2s ease;
        }
        .ph-card:hover { border-color: rgba(255,255,255,0.11); }
        .ph-card-title {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.68rem; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.4);
          margin-bottom: 0.85rem;
        }

        /* ── stats row ── */
        .ph-stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem; margin-bottom: 1rem;
        }
        .ph-stat-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 1rem;
          text-align: center;
        }
        .ph-stat-value {
          font-size: 1.8rem; font-weight: 700; color: #f1f5f9;
          line-height: 1;
        }
        .ph-stat-value.blue { color: #60a5fa; }
        .ph-stat-value.green { color: #4ade80; }
        .ph-stat-value.purple { color: #a78bfa; }
        .ph-stat-label {
          font-size: 0.7rem; color: rgba(255,255,255,0.35);
          margin-top: 0.4rem; font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.03em; text-transform: uppercase;
        }

        /* ── invite code ── */
        .ph-invite-box {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem;
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 10px;
        }
        .ph-invite-code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.3rem; letter-spacing: 0.2em;
          color: #60a5fa; font-weight: 500;
        }
        .ph-copy-btn {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem 0.65rem; border-radius: 6px;
          background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd; font-size: 0.72rem;
          cursor: pointer; transition: all 0.15s ease;
          font-family: 'Outfit', sans-serif;
        }
        .ph-copy-btn:hover {
          background: rgba(59,130,246,0.25);
        }

        /* ── member list ── */
        .ph-member-list { display: flex; flex-direction: column; gap: 0.45rem; }
        .ph-member-item {
          display: flex; align-items: center; gap: 0.7rem;
          padding: 0.6rem 0.7rem;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; background: rgba(255,255,255,0.015);
          transition: all 0.15s ease;
        }
        .ph-member-item:hover {
          background: rgba(255,255,255,0.035);
          border-color: rgba(255,255,255,0.1);
        }
        .ph-member-avatar {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.78rem; font-weight: 600; color: #fff;
          flex-shrink: 0;
        }
        .ph-member-email {
          font-size: 0.85rem; color: rgba(255,255,255,0.8);
        }
        .ph-member-badge {
          margin-left: auto;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.58rem; letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 0.12rem 0.4rem; border-radius: 999px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.2);
          color: #60a5fa;
        }

        /* ── task form ── */
        .ph-form-toggle {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.55rem 0.85rem; border-radius: 8px;
          background: #3b82f6; border: none; color: #fff;
          font-size: 0.8rem; font-weight: 500; cursor: pointer;
          transition: all 0.15s ease; margin-bottom: 1rem;
          font-family: 'Outfit', sans-serif;
        }
        .ph-form-toggle:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(59,130,246,0.3); }
        .ph-form-toggle:active { transform: translateY(0); }

        .ph-form-panel {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 1.1rem;
          margin-bottom: 1.25rem;
          animation: slideDown 0.2s ease forwards;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ph-form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;
        }
        .ph-form-full { grid-column: 1 / -1; }
        .ph-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          margin-bottom: 0.3rem;
        }
        .ph-input, .ph-select, .ph-textarea {
          width: 100%; padding: 0.6rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 7px; color: #f1f5f9;
          font-family: 'Outfit', sans-serif; font-size: 0.85rem;
          outline: none; transition: all 0.15s ease;
        }
        .ph-input:focus, .ph-select:focus, .ph-textarea:focus {
          border-color: rgba(59,130,246,0.5);
          background: rgba(59,130,246,0.04);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
        }
        .ph-textarea { min-height: 70px; resize: vertical; }
        .ph-select option { background: #0d1019; color: #e2e8f0; }
        .ph-form-actions {
          display: flex; gap: 0.5rem; margin-top: 0.7rem;
        }
        .ph-btn {
          padding: 0.52rem 1rem; border-radius: 7px;
          font-family: 'Outfit', sans-serif; font-size: 0.8rem;
          font-weight: 500; cursor: pointer;
          transition: all 0.15s ease; border: none;
        }
        .ph-btn-primary { background: #3b82f6; color: #fff; }
        .ph-btn-primary:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,130,246,0.3); }
        .ph-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
        .ph-btn-ghost {
          background: transparent; border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.4);
        }
        .ph-btn-ghost:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); }

        /* ── task cards ── */
        .ph-task-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .ph-task-card {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; background: rgba(255,255,255,0.018);
          padding: 0.9rem 1rem;
          transition: all 0.15s ease;
        }
        .ph-task-card:hover {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
        }
        .ph-task-card.verified {
          border-color: rgba(34,197,94,0.2);
        }
        .ph-task-top {
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.8rem; margin-bottom: 0.35rem;
        }
        .ph-task-title {
          font-size: 0.92rem; font-weight: 500; color: #f1f5f9;
        }
        .ph-chip {
          padding: 0.15rem 0.55rem; border-radius: 999px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.04em;
          text-transform: uppercase; flex-shrink: 0;
        }
        .ph-chip-pending {
          background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25);
          color: #fbbf24;
        }
        .ph-chip-completed {
          background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25);
          color: #60a5fa;
        }
        .ph-chip-verified {
          background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);
          color: #4ade80;
        }
        .ph-task-meta {
          font-size: 0.75rem; color: rgba(255,255,255,0.4);
          display: flex; align-items: center; gap: 0.8rem;
          flex-wrap: wrap;
        }
        .ph-task-desc {
          margin-top: 0.4rem; font-size: 0.82rem;
          color: rgba(255,255,255,0.55); line-height: 1.5;
        }
        .ph-task-actions {
          display: flex; gap: 0.45rem; margin-top: 0.6rem;
          flex-wrap: wrap;
        }
        .ph-vouch-bar {
          display: flex; align-items: center; gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .ph-vouch-track {
          flex: 1; max-width: 120px; height: 4px;
          background: rgba(255,255,255,0.06); border-radius: 999px;
          overflow: hidden;
        }
        .ph-vouch-fill {
          height: 100%; border-radius: 999px;
          transition: width 0.3s ease;
        }
        .ph-vouch-fill.partial { background: #f59e0b; }
        .ph-vouch-fill.full { background: #4ade80; }
        .ph-vouch-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem; color: rgba(255,255,255,0.35);
        }

        .ph-action-btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.38rem 0.65rem; border-radius: 6px;
          font-size: 0.75rem; cursor: pointer;
          transition: all 0.15s ease; font-family: 'Outfit', sans-serif;
          border: none;
        }
        .ph-action-complete {
          background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);
          color: #4ade80;
        }
        .ph-action-complete:hover { background: rgba(34,197,94,0.2); }
        .ph-action-complete:disabled { opacity: 0.4; cursor: not-allowed; }
        .ph-action-vouch {
          background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.3);
          color: #a78bfa;
        }
        .ph-action-vouch:hover { background: rgba(139,92,246,0.2); }
        .ph-action-vouch:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── analytics ── */
        .ph-highlight-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .ph-highlight-card {
          padding: 1rem; border-radius: 10px;
        }
        .ph-highlight-card.top {
          background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02));
          border: 1px solid rgba(34,197,94,0.15);
        }
        .ph-highlight-card.low {
          background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02));
          border: 1px solid rgba(245,158,11,0.15);
        }
        .ph-highlight-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 0.5rem;
        }
        .ph-highlight-card.top .ph-highlight-label { color: rgba(34,197,94,0.6); }
        .ph-highlight-card.low .ph-highlight-label { color: rgba(245,158,11,0.6); }
        .ph-highlight-name {
          font-size: 0.92rem; font-weight: 500; color: #f1f5f9;
          margin-bottom: 0.15rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ph-highlight-score {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.4rem; font-weight: 700;
        }
        .ph-highlight-card.top .ph-highlight-score { color: #4ade80; }
        .ph-highlight-card.low .ph-highlight-score { color: #fbbf24; }

        .ph-table-wrap {
          overflow-x: auto;
        }
        .ph-table {
          width: 100%; border-collapse: collapse; font-size: 0.78rem;
        }
        .ph-table th {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.06em;
          text-transform: uppercase; color: rgba(255,255,255,0.4);
          text-align: left; padding: 0.5rem 0.6rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ph-table td {
          padding: 0.55rem 0.6rem; color: rgba(255,255,255,0.75);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .ph-table tr:hover td { background: rgba(255,255,255,0.015); }
        .ph-score-badge {
          display: inline-block; padding: 0.15rem 0.5rem;
          border-radius: 999px; font-weight: 600;
          font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem;
        }
        .ph-score-high { background: rgba(34,197,94,0.12); color: #4ade80; }
        .ph-score-mid { background: rgba(245,158,11,0.12); color: #fbbf24; }
        .ph-score-low { background: rgba(239,68,68,0.12); color: #f87171; }

        .ph-empty {
          text-align: center; padding: 2rem 1rem;
          color: rgba(255,255,255,0.25); font-size: 0.85rem;
        }

        /* loading */
        @keyframes phSpin { to { transform: rotate(360deg); } }
        .ph-spinner {
          width: 24px; height: 24px;
          border: 2.5px solid rgba(59,130,246,0.15);
          border-top-color: #3b82f6; border-radius: 50%;
          animation: phSpin 0.7s linear infinite;
          margin: 3rem auto;
        }

        .ph-loading-root {
          flex: 1; display: flex; align-items: center; justify-content: center;
        }

        /* tab fade-in */
        .ph-tab-content {
          animation: phFadeIn 0.25s ease forwards;
        }
        @keyframes phFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Mobile: collapse sidebar into top bar */
        @media (max-width: 768px) {
          .ph-root { flex-direction: column; }
          .ph-sidebar {
            width: 100%; min-height: auto;
            border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          .ph-sidebar-header { display: none; }
          .ph-nav {
            display: flex; flex-direction: row; gap: 0; padding: 0.4rem;
            overflow-x: auto;
          }
          .ph-nav-item { margin-bottom: 0; flex-shrink: 0; justify-content: center; }
          .ph-sidebar-footer { display: none; }
          .ph-main { padding: 1.25rem; }
        }
      `}</style>

      <div className="ph-root">
        {/* ── sidebar ── */}
        <aside className="ph-sidebar">
          <div className="ph-sidebar-header">
            <div className="ph-brand-row">
              <div className="ph-brand-icon">
                <svg viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 3.5L9 7L5.5 10.5L2 7Z" fill="white" fillOpacity="0.9" />
                  <path d="M7 7L10.5 3.5L13 6L10.5 8.5L7 7Z" fill="white" fillOpacity="0.5" />
                </svg>
              </div>
              <span className="ph-brand-name">Vouch</span>
            </div>
            <div className="ph-project-name">{project?.name ?? 'Loading...'}</div>
          </div>

          <nav className="ph-nav">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`ph-nav-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="ph-sidebar-footer">
            <span className={`ph-role-badge ${isLead ? 'ph-role-lead' : 'ph-role-member'}`}>
              {isLead ? '◆ Lead' : '● Member'}
            </span>
            <button className="ph-back-btn" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard
            </button>
          </div>
        </aside>

        {/* ── main ── */}
        <main className="ph-main">
          {loading ? (
            <div className="ph-loading-root"><div className="ph-spinner" /></div>
          ) : (
            <div className="ph-content">
              {/* ══════════ OVERVIEW TAB ══════════ */}
              {activeTab === 'overview' && (
                <div className="ph-tab-content" key="overview">
                  <div className="ph-page-header">
                    <div className="ph-page-title">{project?.name}</div>
                    <div className="ph-page-subtitle">Project overview and team management</div>
                  </div>

                  {/* Stats */}
                  <div className="ph-stats-row">
                    <div className="ph-stat-card">
                      <div className="ph-stat-value blue">{members.length}</div>
                      <div className="ph-stat-label">Members</div>
                    </div>
                    <div className="ph-stat-card">
                      <div className="ph-stat-value green">{tasks.length}</div>
                      <div className="ph-stat-label">Tasks</div>
                    </div>
                    <div className="ph-stat-card">
                      <div className="ph-stat-value purple">{verifiedTasks.length}</div>
                      <div className="ph-stat-label">Verified</div>
                    </div>
                  </div>

                  {/* Invite Code */}
                  {isLead && (
                    <div className="ph-card">
                      <div className="ph-card-title">Invite Code</div>
                      <div className="ph-invite-box">
                        <span className="ph-invite-code">{project?.invite_code}</span>
                        <button className="ph-copy-btn" onClick={copyInviteCode}>
                          {copied ? '✓ Copied' : '⎘ Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team */}
                  <div className="ph-card">
                    <div className="ph-card-title">Team Members ({members.length})</div>
                    {members.length === 0 ? (
                      <div className="ph-empty">No members yet. Share the invite code!</div>
                    ) : (
                      <div className="ph-member-list">
                        {members.map((member, idx) => (
                          <div key={`${member.user_id}-${idx}`} className="ph-member-item">
                            <div
                              className="ph-member-avatar"
                              style={{ background: getAvatarColor(member.email) }}
                            >
                              {getInitial(member.email)}
                            </div>
                            <span className="ph-member-email">{member.email}</span>
                            {project && sameUserId(member.user_id, project.creator_id) && (
                              <span className="ph-member-badge">Lead</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══════════ TASKS TAB ══════════ */}
              {activeTab === 'tasks' && (
                <div className="ph-tab-content" key="tasks">
                  <div className="ph-page-header">
                    <div className="ph-page-title">Tasks</div>
                    <div className="ph-page-subtitle">
                      {pendingTasks.length} pending · {completedTasks.length} completed · {verifiedTasks.length} verified
                    </div>
                  </div>

                  {/* Create Task Form */}
                  {isLead && (
                    <>
                      {!showCreateForm ? (
                        <button className="ph-form-toggle" onClick={() => setShowCreateForm(true)}>
                          + New Task
                        </button>
                      ) : (
                        <div className="ph-form-panel">
                          <div className="ph-form-grid">
                            <div className="ph-form-full">
                              <label className="ph-label">Task Title</label>
                              <input
                                className="ph-input"
                                placeholder="e.g. Design homepage wireframe"
                                value={taskTitle}
                                onChange={e => setTaskTitle(e.target.value)}
                              />
                            </div>
                            <div className="ph-form-full">
                              <label className="ph-label">Description</label>
                              <textarea
                                className="ph-textarea"
                                placeholder="Optional task details..."
                                value={taskDescription}
                                onChange={e => setTaskDescription(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="ph-label">Due Date</label>
                              <input
                                className="ph-input"
                                type="date"
                                value={taskDueDate}
                                onChange={e => setTaskDueDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="ph-label">Assign To</label>
                              <select
                                className="ph-select"
                                value={taskAssignedTo}
                                onChange={e => setTaskAssignedTo(e.target.value)}
                              >
                                <option value="">Select member...</option>
                                {members.map((m, idx) => (
                                  <option key={`${m.user_id}-${idx}`} value={m.user_id}>{m.email}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="ph-form-actions">
                            <button className="ph-btn ph-btn-primary" onClick={handleCreateTask} disabled={taskLoading}>
                              {taskLoading ? 'Creating...' : 'Create Task'}
                            </button>
                            <button className="ph-btn ph-btn-ghost" onClick={() => setShowCreateForm(false)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!isLead && (
                    <div className="ph-card" style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                        Only the project lead can create tasks. Complete tasks assigned to you and vouch for your teammates.
                      </div>
                    </div>
                  )}

                  {/* Task List */}
                  {tasks.length === 0 ? (
                    <div className="ph-card">
                      <div className="ph-empty">No tasks created yet. {isLead && 'Click "+ New Task" to get started!'}</div>
                    </div>
                  ) : (
                    <div className="ph-task-list">
                      {tasks.map(task => {
                        const assignedEmail = task.assigned_to ? memberEmailById[task.assigned_to] : null
                        const vouchCount = getTaskVouchCount(task.id)
                        const isVerified = task.status === 'completed' && vouchCount >= 2
                        const canComplete = !!currentUserId && task.status !== 'completed' && task.assigned_to === currentUserId
                        const canVouch = !!currentUserId && task.status === 'completed' && task.assigned_to !== currentUserId && !hasCurrentUserVouched(task.id) && vouchCount < 2

                        const chipClass = isVerified ? 'ph-chip-verified' : task.status === 'completed' ? 'ph-chip-completed' : 'ph-chip-pending'
                        const chipLabel = isVerified ? 'verified' : task.status

                        return (
                          <div key={task.id} className={`ph-task-card ${isVerified ? 'verified' : ''}`}>
                            <div className="ph-task-top">
                              <span className="ph-task-title">{task.title}</span>
                              <span className={`ph-chip ${chipClass}`}>{chipLabel}</span>
                            </div>
                            <div className="ph-task-meta">
                              <span>📋 {assignedEmail ?? 'Unassigned'}</span>
                              <span>📅 {task.due_date ?? 'No due date'}</span>
                            </div>
                            {task.description && <div className="ph-task-desc">{task.description}</div>}

                            {/* Vouch Progress */}
                            {task.status === 'completed' && (
                              <div className="ph-vouch-bar">
                                <div className="ph-vouch-track">
                                  <div
                                    className={`ph-vouch-fill ${vouchCount >= 2 ? 'full' : 'partial'}`}
                                    style={{ width: `${(vouchCount / 2) * 100}%` }}
                                  />
                                </div>
                                <span className="ph-vouch-text">{vouchCount}/2 vouches</span>
                              </div>
                            )}

                            <div className="ph-task-actions">
                              {canComplete && (
                                <button className="ph-action-btn ph-action-complete" onClick={() => handleCompleteTask(task.id)} disabled={taskLoading}>
                                  {taskLoading ? '...' : '✓ Mark Complete'}
                                </button>
                              )}
                              {canVouch && (
                                <button className="ph-action-btn ph-action-vouch" onClick={() => handleVouchTask(task)} disabled={taskLoading}>
                                  {taskLoading ? '...' : '★ Vouch'}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════ ANALYTICS TAB ══════════ */}
              {activeTab === 'analytics' && (
                <div className="ph-tab-content" key="analytics">
                  <div className="ph-page-header">
                    <div className="ph-page-title">Analytics</div>
                    <div className="ph-page-subtitle">Team reliability scores and performance metrics</div>
                  </div>

                  {analytics.length === 0 ? (
                    <div className="ph-card">
                      <div className="ph-empty">No data available yet. Add team members and tasks to see analytics.</div>
                    </div>
                  ) : (
                    <>
                      {/* Top / Low highlights */}
                      <div className="ph-highlight-row">
                        <div className="ph-highlight-card top">
                          <div className="ph-highlight-label">🏆 Top Performer</div>
                          <div className="ph-highlight-name">{topPerformer?.email}</div>
                          <div className="ph-highlight-score">{topPerformer?.reliabilityScore}</div>
                        </div>
                        {laggingPerformer && (
                          <div className="ph-highlight-card low">
                            <div className="ph-highlight-label">⚡ Needs Support</div>
                            <div className="ph-highlight-name">{laggingPerformer.email}</div>
                            <div className="ph-highlight-score">{laggingPerformer.reliabilityScore}</div>
                          </div>
                        )}
                      </div>

                      {/* Scoring breakdown */}
                      <div className="ph-card" style={{ marginBottom: '1rem' }}>
                        <div className="ph-card-title">Reliability Score Formula</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                          <span style={{ color: '#4ade80' }}>50%</span> Tasks completed on time ·{' '}
                          <span style={{ color: '#60a5fa' }}>30%</span> Vouches received ·{' '}
                          <span style={{ color: '#a78bfa' }}>20%</span> Vouches given
                        </div>
                      </div>

                      {/* Leaderboard */}
                      <div className="ph-card">
                        <div className="ph-card-title">Leaderboard</div>
                        <div className="ph-table-wrap">
                          <table className="ph-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Member</th>
                                <th>Assigned</th>
                                <th>Completed</th>
                                <th>On-Time</th>
                                <th>V. Recv</th>
                                <th>V. Given</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.map((row, i) => {
                                const scoreClass = row.reliabilityScore >= 70 ? 'ph-score-high' : row.reliabilityScore >= 40 ? 'ph-score-mid' : 'ph-score-low'
                                return (
                                  <tr key={`${row.user_id}-${i}`}>
                                    <td style={{ color: 'rgba(255,255,255,0.3)' }}>{i + 1}</td>
                                    <td style={{ fontWeight: 500 }}>{row.email}</td>
                                    <td>{row.assignedCount}</td>
                                    <td>{row.completedCount}</td>
                                    <td>{row.completedOnTimeCount}</td>
                                    <td>{row.vouchesReceived}</td>
                                    <td>{row.vouchesGiven}</td>
                                    <td>
                                      <span className={`ph-score-badge ${scoreClass}`}>
                                        {row.reliabilityScore}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
