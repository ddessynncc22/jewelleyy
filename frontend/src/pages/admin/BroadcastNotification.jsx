import { useState, createElement } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Megaphone, Send, Info, AlertTriangle, AlertCircle, Bell, X } from 'lucide-react'
import { broadcastNotification, getBroadcastNotifications } from '../../services/adminService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'

const typeIcons = { info: Info, warning: AlertTriangle, maintenance: AlertCircle, announcement: Megaphone }
const typeColors = { info: 'bg-blue-50 text-blue-700', warning: 'bg-yellow-50 text-yellow-700', maintenance: 'bg-red-50 text-red-700', announcement: 'bg-purple-50 text-purple-700' }

export default function BroadcastNotification() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: '', message: '', type: 'announcement' })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['broadcast-notifications'],
    queryFn: () => getBroadcastNotifications().then(r => r.data.data || r.data),
  })

  const mutation = useMutation({
    mutationFn: () => broadcastNotification(form),
    onSuccess: () => { toast.success('Broadcast sent to all tenants'); setForm({ title: '', message: '', type: 'announcement' }); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to send'),
  })

  const notifications = Array.isArray(data) ? data : []

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Broadcast Notification" subtitle="Send messages to all shops" />

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Notification Type</label>
            <div className="flex gap-3">
              {['announcement', 'info', 'warning', 'maintenance'].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${form.type === t ? `${typeColors[t]} ring-2 ring-offset-1` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {typeIcons[t] ? <span>{createElement(typeIcons[t], { size: 16 })}</span> : null}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input name="title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea name="message" value={form.message} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} rows={4}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2" required />
          </div>
          <Button type="submit" loading={mutation.isPending} icon={<Send size={14} />}>
            Send Broadcast
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Sent Broadcasts</h3>
          <Button variant="ghost" size="sm" onClick={refetch} icon={<Bell size={14} />}>Refresh</Button>
        </div>
        {isLoading ? <LoadingSkeleton count={3} type="row" /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
          <div className="space-y-3">
            {notifications.map(n => (
              <div key={n._id} className="p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${typeColors[n.type] || typeColors.announcement}`}>{n.type}</span>
                  <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                <p className="text-xs text-gray-400 mt-2">{n.readBy?.length || 0} shops read</p>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No broadcasts sent yet</p>}
          </div>
        )}
      </Card>
    </div>
  )
}
