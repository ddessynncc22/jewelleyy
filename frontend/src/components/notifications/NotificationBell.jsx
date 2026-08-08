import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Info, AlertTriangle, AlertCircle, Megaphone, X } from 'lucide-react'
import { getMyNotifications, markNotificationRead } from '../../services/notificationService'
import { useAuth } from '../../hooks/useAuth'

const typeIcons = { info: Info, warning: AlertTriangle, maintenance: AlertCircle, announcement: Megaphone }
const typeColors = { info: 'bg-info/10 text-info', warning: 'bg-warning/10 text-warning', maintenance: 'bg-danger/10 text-danger', announcement: 'bg-violet-100 text-violet-700' }

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => getMyNotifications().then(r => r.data.data || r.data),
    refetchInterval: 60000,
  })

  const notifications = Array.isArray(data) ? data : []
  const unread = notifications.filter(n => !n.readBy?.includes(user?._id)).length

  const markReadMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  })

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] transition-colors">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-danger rounded-full shadow-[0_2px_6px_rgba(220,38,38,0.4)]">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-lg)] z-50 animate-fade-up">
          <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-card)]">
            <span className="text-sm font-semibold text-[var(--color-text)]">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><X size={16} /></button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">No notifications</p>
          ) : (
            notifications.map(n => {
              const isRead = n.readBy?.includes(user?._id)
              return (
                <div key={n._id} className={`p-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-ink-50)] cursor-pointer transition-colors ${!isRead ? 'bg-[var(--color-primary-bg)]/60' : ''}`}
                  onClick={() => { if (!isRead) markReadMutation.mutate(n._id) }}>
                  <div className="flex items-start gap-2">
                    <span className={`p-1.5 rounded-lg shrink-0 ${typeColors[n.type] || 'bg-ink-100 text-ink-500'}`}>
                      {(() => { const Icon = typeIcons[n.type] || Megaphone; return <Icon size={14} /> })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-[var(--color-ink-400)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-[var(--color-gold-500)] shrink-0 mt-1.5" />}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}