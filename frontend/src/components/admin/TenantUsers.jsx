import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, UserPlus, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'
import { getTenantUsers, createTenantUser, updateTenantUser } from '../../services/adminService'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

export default function TenantUsers({ tenantId }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', phone: '' })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-users', tenantId],
    queryFn: () => getTenantUsers(tenantId).then(r => r.data.data || r.data),
  })

  const users = Array.isArray(data) ? data : []

  const createMutation = useMutation({
    mutationFn: () => createTenantUser(tenantId, form),
    onSuccess: () => { toast.success('User created'); setShowForm(false); setForm({ name: '', email: '', password: '', role: 'staff', phone: '' }); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }) => updateTenantUser(tenantId, userId, { isActive: !isActive }),
    onSuccess: () => { toast.success('User status updated'); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId }) => updateTenantUser(tenantId, userId, { password: 'Nepal@123' }),
    onSuccess: () => toast.success('Password reset to Nepal@123'),
    onError: (err) => toast.error(err.response?.data?.message || 'Reset failed'),
  })

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2"><Users size={16} /> Users ({users.length})</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} icon={<RefreshCw size={14} />} />
          <Button size="sm" onClick={() => setShowForm(!showForm)} icon={<UserPlus size={14} />}>
            {showForm ? 'Cancel' : 'Add User'}
          </Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input name="name" placeholder="Name *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required className="rounded-xl border px-3.5 py-2.5 text-sm" />
            <input name="email" type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required className="rounded-xl border px-3.5 py-2.5 text-sm" />
            <input name="password" type="password" placeholder="Password *" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required className="rounded-xl border px-3.5 py-2.5 text-sm" />
            <select name="role" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} className="rounded-xl border px-3.5 py-2.5 text-sm">
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="qr_lookup">QR Lookup</option>
            </select>
            <input name="phone" placeholder="Phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl border px-3.5 py-2.5 text-sm" />
          </div>
          <Button type="submit" loading={createMutation.isPending} icon={<UserPlus size={14} />}>Create User</Button>
        </form>
      )}

      {isLoading ? <LoadingSkeleton count={3} type="row" /> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-gray-400">{u.email} · {u.role}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => toggleActiveMutation.mutate({ userId: u._id, isActive: u.isActive })} title={u.isActive ? 'Deactivate' : 'Activate'}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
                  {u.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                </button>
                <button onClick={() => { if (confirm('Reset password to Nepal@123?')) resetPasswordMutation.mutate({ userId: u._id }) }} title="Reset Password"
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
                  <KeyRound size={16} />
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No users</p>}
        </div>
      )}
    </Card>
  )
}
