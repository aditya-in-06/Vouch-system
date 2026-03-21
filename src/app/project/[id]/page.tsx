'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

type Project = {
  id: string
  name: string
  invite_code: string
  creator_id: string
}

type Member = {
  user_id: string
  email: string
}

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  assigned_to: string | null
}

type TaskVouch = {
  task_id: string
  voucher_user_id: string
}

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

export default function ProjectHubPage() {
  const params = useParams<{ id: string }>()
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

  useEffect(() => {
    const loadProjectData = async () => {
      if (!params?.id) return
      setLoading(true)

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
        .eq('id', params.id)
        .single()

      if (projectError || !projectData) {
        alert('Project not found.')
        router.push('/dashboard')
        return
      }

      const { data: memberRows, error: membersError } = await supabase
        .from('members')
        .select('user_id, email')
        .eq('project_id', params.id)

      if (membersError) {
        alert('Could not load members list.')
        setLoading(false)
        return
      }

      const { data: taskRows, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, assigned_to')
        .eq('project_id', params.id)
        .order('due_date', { ascending: true })

      if (tasksError) {
        alert('Could not load tasks list.')
        setLoading(false)
        return
      }

      const { data: vouchRows, error: vouchesError } = await supabase
        .from('task_vouches')
        .select('task_id, voucher_user_id')
        .eq('project_id', params.id)

      if (vouchesError) {
        alert('Could not load vouch data.')
        setLoading(false)
        return
      }

      setProject(projectData)
      setMembers(memberRows ?? [])
      setTasks(taskRows ?? [])
      setTaskVouches(vouchRows ?? [])
      setLoading(false)
    }

    loadProjectData()
  }, [params?.id, router])

  const isLead = !!(project && currentUserId && project.creator_id === currentUserId)

  const memberEmailById = members.reduce<Record<string, string>>((acc, member) => {
    acc[member.user_id] = member.email
    return acc
  }, {})

  const refreshTasks = async () => {
    const { data: taskRows, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, status, assigned_to')
      .eq('project_id', params.id)
      .order('due_date', { ascending: true })

    if (tasksError) {
      alert(`Could not refresh tasks: ${tasksError.message}`)
      return
    }

    setTasks(taskRows ?? [])

    const { data: vouchRows, error: vouchesError } = await supabase
      .from('task_vouches')
      .select('task_id, voucher_user_id')
      .eq('project_id', params.id)

    if (vouchesError) {
      alert(`Could not refresh vouches: ${vouchesError.message}`)
      return
    }

    setTaskVouches(vouchRows ?? [])
  }

  const handleCreateTask = async () => {
    if (!isLead) return
    if (!taskTitle.trim()) return alert('Task title is required.')
    if (!taskAssignedTo) return alert('Please assign the task to a member.')

    setTaskLoading(true)
    const { error } = await supabase.from('tasks').insert([
      {
        project_id: params.id,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        due_date: taskDueDate || null,
        assigned_to: taskAssignedTo,
        status: 'pending',
      },
    ])

    if (error) {
      alert(`Could not create task: ${error.message}`)
      setTaskLoading(false)
      return
    }

    setTaskTitle('')
    setTaskDescription('')
    setTaskDueDate('')
    setTaskAssignedTo('')
    await refreshTasks()
    setTaskLoading(false)
  }

  const handleCompleteTask = async (taskId: string) => {
    setTaskLoading(true)
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskId)
      .eq('project_id', params.id)

    if (error) {
      alert(`Could not complete task: ${error.message}`)
      setTaskLoading(false)
      return
    }

    await refreshTasks()
    setTaskLoading(false)
  }

  const getTaskVouchCount = (taskId: string) => {
    return taskVouches.filter((entry) => entry.task_id === taskId).length
  }

  const hasCurrentUserVouched = (taskId: string) => {
    if (!currentUserId) return false
    return taskVouches.some(
      (entry) => entry.task_id === taskId && entry.voucher_user_id === currentUserId
    )
  }

  const handleVouchTask = async (task: Task) => {
    if (!currentUserId) return
    if (task.assigned_to === currentUserId) {
      alert('You cannot vouch for your own task.')
      return
    }
    if (task.status !== 'completed') {
      alert('Only completed tasks can be vouched.')
      return
    }
    if (hasCurrentUserVouched(task.id)) {
      alert('You already vouched for this task.')
      return
    }
    if (getTaskVouchCount(task.id) >= 2) {
      alert('This task already has enough vouches.')
      return
    }

    setTaskLoading(true)
    const { error: vouchError } = await supabase.from('task_vouches').insert([
      {
        project_id: params.id,
        task_id: task.id,
        voucher_user_id: currentUserId,
      },
    ])

    if (vouchError) {
      alert(`Could not record vouch: ${vouchError.message}`)
      setTaskLoading(false)
      return
    }

    await refreshTasks()
    setTaskLoading(false)
  }

  const getMemberAnalytics = (): MemberAnalytics[] => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const vouchesByTask = taskVouches.reduce<Record<string, number>>((acc, vouch) => {
      acc[vouch.task_id] = (acc[vouch.task_id] ?? 0) + 1
      return acc
    }, {})

    const taskById = tasks.reduce<Record<string, Task>>((acc, task) => {
      acc[task.id] = task
      return acc
    }, {})

    return members.map((member) => {
      const assignedTasks = tasks.filter((task) => task.assigned_to === member.user_id)
      const completedTasks = assignedTasks.filter((task) => task.status === 'completed')
      const completedOnTimeTasks = completedTasks.filter((task) => {
        if (!task.due_date) return true
        return task.due_date >= todayISO
      })

      const vouchesReceived = completedTasks.reduce((sum, task) => {
        return sum + (vouchesByTask[task.id] ?? 0)
      }, 0)

      const vouchesGiven = taskVouches.filter((vouch) => vouch.voucher_user_id === member.user_id).length

      const assignedCount = assignedTasks.length
      const completedCount = completedTasks.length
      const completedOnTimeCount = completedOnTimeTasks.length

      const onTimeRate = completedCount > 0 ? completedOnTimeCount / completedCount : 0
      const receiveRate = completedCount > 0 ? Math.min(vouchesReceived / (completedCount * 2), 1) : 0
      const giveRate = assignedCount > 0 ? Math.min(vouchesGiven / Math.max(assignedCount, 1), 1) : 0

      const reliabilityScore = Math.round(onTimeRate * 50 + receiveRate * 30 + giveRate * 20)

      return {
        user_id: member.user_id,
        email: member.email,
        assignedCount,
        completedCount,
        completedOnTimeCount,
        vouchesReceived,
        vouchesGiven,
        reliabilityScore,
      }
    })
  }

  const analytics = getMemberAnalytics().sort((a, b) => b.reliabilityScore - a.reliabilityScore)
  const topPerformer = analytics[0]
  const laggingPerformer = analytics[analytics.length - 1]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hub-root {
          min-height: 100vh;
          background: #080a0f;
          color: #e2e8f0;
          font-family: 'Outfit', sans-serif;
          padding: 1.25rem;
        }

        .hub-shell {
          max-width: 920px;
          margin: 0 auto;
        }

        .hub-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          background: rgba(13, 16, 25, 0.8);
        }

        .hub-title {
          font-size: 1.2rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .hub-sub {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.55);
          font-family: 'IBM Plex Mono', monospace;
        }

        .hub-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .hub-card {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          background: rgba(13, 16, 25, 0.8);
          padding: 1rem;
        }

        .hub-card-title {
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.65);
          margin-bottom: 0.8rem;
          font-family: 'IBM Plex Mono', monospace;
        }

        .hub-code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.15rem;
          letter-spacing: 0.18em;
          color: #60a5fa;
        }

        .hub-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .hub-list-item {
          padding: 0.65rem 0.75rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          font-size: 0.9rem;
        }

        .hub-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.6rem;
        }

        .hub-input, .hub-select, .hub-textarea {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          color: #e2e8f0;
          border-radius: 8px;
          padding: 0.62rem 0.72rem;
          font-size: 0.88rem;
          font-family: 'Outfit', sans-serif;
          outline: none;
        }

        .hub-textarea {
          min-height: 90px;
          resize: vertical;
        }

        .hub-btn {
          border: 1px solid #3b82f6;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          padding: 0.62rem 0.82rem;
          font-size: 0.82rem;
          cursor: pointer;
          width: fit-content;
        }

        .hub-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .hub-task-list {
          list-style: none;
          display: grid;
          gap: 0.7rem;
        }

        .hub-task-item {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          padding: 0.75rem;
        }

        .hub-task-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
        }

        .hub-task-title {
          font-size: 0.95rem;
          font-weight: 500;
        }

        .hub-chip {
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          padding: 0.15rem 0.5rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.75);
          text-transform: uppercase;
        }

        .hub-chip.ok {
          border-color: rgba(34,197,94,0.45);
          color: #86efac;
        }

        .hub-task-meta {
          margin-top: 0.35rem;
          color: rgba(255,255,255,0.65);
          font-size: 0.78rem;
        }

        .hub-task-desc {
          margin-top: 0.35rem;
          color: rgba(255,255,255,0.82);
          font-size: 0.85rem;
        }

        .hub-complete-btn {
          margin-top: 0.55rem;
          border: 1px solid rgba(34,197,94,0.6);
          background: rgba(34,197,94,0.14);
          color: #86efac;
          border-radius: 7px;
          padding: 0.4rem 0.62rem;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .hub-complete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .hub-analytics-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.7rem;
        }

        .hub-metric {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          padding: 0.7rem;
          font-size: 0.84rem;
          color: rgba(255,255,255,0.85);
        }

        .hub-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          margin-top: 0.4rem;
        }

        .hub-table th, .hub-table td {
          border-bottom: 1px solid rgba(255,255,255,0.08);
          text-align: left;
          padding: 0.45rem 0.35rem;
          color: rgba(255,255,255,0.82);
        }

        .hub-table th {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.6);
        }
      `}</style>

      <div className="hub-root">
        <div className="hub-shell">
          <header className="hub-header">
            <div>
              <div className="hub-title">{project?.name ?? 'Project Hub'}</div>
              <div className="hub-sub">vouch / project / {params?.id}</div>
            </div>
            <div className="hub-sub">{isLead ? 'Role: Lead' : 'Role: Member'}</div>
          </header>

          {loading ? (
            <div className="hub-card">Loading project details...</div>
          ) : (
            <section className="hub-grid">
              {isLead && (
                <div className="hub-card">
                  <div className="hub-card-title">Invite Code</div>
                  <div className="hub-code">{project?.invite_code}</div>
                </div>
              )}

              <div className="hub-card">
                <div className="hub-card-title">Team Members ({members.length})</div>
                {members.length === 0 ? (
                  <div className="hub-sub">No members found yet.</div>
                ) : (
                  <ul className="hub-list">
                    {members.map((member) => (
                      <li key={member.user_id} className="hub-list-item">
                        {member.email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="hub-card">
                <div className="hub-card-title">Tasks</div>

                {isLead && (
                  <div className="hub-form-grid">
                    <input
                      className="hub-input"
                      placeholder="Task title"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                    <textarea
                      className="hub-textarea"
                      placeholder="Task description"
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                    />
                    <input
                      className="hub-input"
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                    />
                    <select
                      className="hub-select"
                      value={taskAssignedTo}
                      onChange={(e) => setTaskAssignedTo(e.target.value)}
                    >
                      <option value="">Assign to member...</option>
                      {members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.email}
                        </option>
                      ))}
                    </select>
                    <button className="hub-btn" onClick={handleCreateTask} disabled={taskLoading}>
                      {taskLoading ? 'Saving...' : 'Create Task'}
                    </button>
                  </div>
                )}

                {!isLead && (
                  <div className="hub-sub" style={{ marginBottom: '0.7rem' }}>
                    Only project lead can create tasks. You can complete tasks assigned to you.
                  </div>
                )}

                {tasks.length === 0 ? (
                  <div className="hub-sub">No tasks yet.</div>
                ) : (
                  <ul className="hub-task-list">
                    {tasks.map((task) => {
                      const assignedEmail = task.assigned_to ? memberEmailById[task.assigned_to] : null
                      const vouchCount = getTaskVouchCount(task.id)
                      const isVerified = task.status === 'completed' && vouchCount >= 2
                      const canComplete =
                        !!currentUserId &&
                        task.status !== 'completed' &&
                        task.assigned_to === currentUserId
                      const canVouch =
                        !!currentUserId &&
                        task.status === 'completed' &&
                        task.assigned_to !== currentUserId &&
                        !hasCurrentUserVouched(task.id) &&
                        vouchCount < 2

                      return (
                        <li key={task.id} className="hub-task-item">
                          <div className="hub-task-row">
                            <div className="hub-task-title">{task.title}</div>
                            <span className={`hub-chip ${isVerified ? 'ok' : ''}`}>
                              {isVerified ? 'verified' : task.status}
                            </span>
                          </div>
                          <div className="hub-task-meta">
                            Assigned: {assignedEmail ?? 'Unassigned'} | Due: {task.due_date ?? 'No due date'}
                          </div>
                          <div className="hub-task-meta">Vouches: {vouchCount} / 2</div>
                          {task.description && <div className="hub-task-desc">{task.description}</div>}
                          {canComplete && (
                            <button
                              className="hub-complete-btn"
                              onClick={() => handleCompleteTask(task.id)}
                              disabled={taskLoading}
                            >
                              {taskLoading ? 'Updating...' : 'Mark Complete'}
                            </button>
                          )}
                          {canVouch && (
                            <button
                              className="hub-complete-btn"
                              onClick={() => handleVouchTask(task)}
                              disabled={taskLoading}
                            >
                              {taskLoading ? 'Submitting...' : 'Vouch'}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="hub-card">
                <div className="hub-card-title">Analytics & Reliability</div>
                {analytics.length === 0 ? (
                  <div className="hub-sub">No members available for analytics yet.</div>
                ) : (
                  <>
                    <div className="hub-analytics-row">
                      <div className="hub-metric">
                        Top reliability: {topPerformer?.email} ({topPerformer?.reliabilityScore})
                      </div>
                      <div className="hub-metric">
                        Needs support: {laggingPerformer?.email} ({laggingPerformer?.reliabilityScore})
                      </div>
                    </div>

                    <table className="hub-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Assigned</th>
                          <th>Completed</th>
                          <th>On-time</th>
                          <th>Vouches Recv</th>
                          <th>Vouches Given</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.map((row) => (
                          <tr key={row.user_id}>
                            <td>{row.email}</td>
                            <td>{row.assignedCount}</td>
                            <td>{row.completedCount}</td>
                            <td>{row.completedOnTimeCount}</td>
                            <td>{row.vouchesReceived}</td>
                            <td>{row.vouchesGiven}</td>
                            <td>{row.reliabilityScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
