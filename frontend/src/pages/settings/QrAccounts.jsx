import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { QrCode, UserPlus, RefreshCw, ToggleLeft, ToggleRight, Trash2, ShieldCheck, X } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '../../services/userService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import FormInput from '../../components/ui/FormInput'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'

const emptyForm = { name: '', email: '', password: '', phone: '' }

export default function QrAccounts() {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const isAdmin = user?.role === 'admin'

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['qr-accounts'],
    queryFn: () => getUsers({ role: 'qr_lookup' }).then((r) => r.data?.data || r.data),
    enabled: isAdmin,
  })

  const users = Array.isArray(data) ? data : data?.users || []

  const createMutation = useMutation({
    mutationFn: () => createUser({ ...form, role: 'qr_lookup' }),
    onSuccess: () => {
      toast.success('QR Lookup account created')
      setShowForm(false)
      setForm(emptyForm)
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create account'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateUser(id, { isActive: !isActive }),
    onSuccess: () => {
      toast.success('Account status updated')
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => deleteUser(id),
    onSuccess: () => {
      toast.success('Account deleted')
      setDeleteTarget(null)
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Admins only"
        description="Only an admin can manage QR Lookup accounts."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Lookup Accounts"
        subtitle="Create and manage accounts that can only scan QR tags and view item prices"
      >
        <Button variant="ghost" onClick={refetch} icon={<RefreshCw size={15} />}>Refresh</Button>
        <Button onClick={() => setShowForm((v) => !v)} icon={showForm ? <X size={15} /> : <UserPlus size={15} />}>
          {showForm ? 'Cancel' : 'Add Account'}
        </Button>
      </PageHeader>

      {showForm && (
        <Card title="New QR Lookup Account" icon={QrCode}>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <FormInput label="Name" name="name" value={form.name} onChange={set('name')} placeholder="e.g. Ramesh Shrestha" required />
            <FormInput label="Email" name="email" type="email" value={form.email} onChange={set('email')} placeholder="scanner@shop.com" required />
            <FormInput label="Password" name="password" type="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" required />
            <FormInput label="Phone" name="phone" value={form.phone} onChange={set('phone')} placeholder="Optional" />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" loading={createMutation.isPending} icon={<UserPlus size={15} />}>
                Create Account
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`QR Lookup Users (${users.length})`} icon={QrCode}>
        {isLoading ? (
          <LoadingSkeleton count={4} type="row" />
        ) : users.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No QR Lookup accounts yet"
            description="Create an account so your staff can scan tags and check prices without opening the full system."
            action={{ label: 'Add Account', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {users.map((u) => (
              <div key={u._id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text)]">{u.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {u.email}{u.phone ? ` · ${u.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: u._id, isActive: u.isActive })}
                    title={u.isActive ? 'Deactivate' : 'Activate'}
                    icon={u.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(u)}
                    title="Delete"
                    className="!text-red-500"
                    icon={<Trash2 size={16} />}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate({ id: deleteTarget._id })}
        title="Delete QR Lookup account?"
        message={`This will permanently remove ${deleteTarget?.name}'s access. They will no longer be able to scan QR tags.`}
        confirmText="Delete"
      />
    </div>
  )
}
