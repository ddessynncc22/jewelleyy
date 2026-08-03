import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Info, AlertTriangle, AlertCircle, Megaphone, X } from 'lucide-react'
import { getMyNotifications, markNotificationRead } from '../../services/notificationService'
import { useAuth } from '../../hooks/useAuth'

const typeIcons = { info: Info, warning: AlertTriangle, maintenance: AlertCircle, announcement: Megaphone }
const typeColors = { info: 'bg-blue-100 text-blue-700', warning: 'bg-yellow-100 text-yellow-700', maintenance: 'bg-red-100 text-red-700', announcement: 'bg-purple-100 text-purple-700' }

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
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl border shadow-xl z-50">
          <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
          ) : (
            notifications.map(n => {
              const isRead = n.readBy?.includes(user?._id)
              return (
                <div key={n._id} className={`p-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer ${!isRead ? 'bg-blue-50/50' : ''}`}
                  onClick={() => { if (!isRead) markReadMutation.mutate(n._id) }}>
                  <div className="flex items-start gap-2">
                    <span className={`p-1.5 rounded-lg shrink-0 ${typeColors[n.type] || 'bg-gray-100 text-gray-600'}`}>
                      {(() => { const Icon = typeIcons[n.type] || Megaphone; return <Icon size={14} /> })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
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
