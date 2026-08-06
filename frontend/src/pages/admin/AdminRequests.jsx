import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Inbox, CheckCircle2, XCircle, UserPlus, KeyRound, RefreshCw, Clock } from 'lucide-react'
import { getAccessRequests, approveAccessRequest, rejectAccessRequest } from '../../services/adminService'
import { listTenants } from '../../services/tenantService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import EmptyState from '../../components/ui/EmptyState'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
}

const TYPE_LABELS = {
  registration: 'Registration',
  password_reset: 'Password Reset',
}

const TYPE_ICONS = {
  registration: UserPlus,
  password_reset: KeyRound,
}

function StatusBadge({ status }) {
  const Icon = STATUS_ICONS[status] || Clock
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      <Icon size={12} /> {status}
    </span>
  )
}

export default function AdminRequests() {
  const [status, setStatus] = useState('pending')
  const [type, setType] = useState('')
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [form, setForm] = useState({ tenantId: '', role: 'staff', password: 'Nepal@123', note: '' })
  const [rejectNote, setRejectNote] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['access-requests', status, type],
    queryFn: () => getAccessRequests({ status, type }).then(r => r.data.data || r.data),
  })

  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants-all'],
    queryFn: () => listTenants({ limit: 100 }).then(r => r.data.data || r.data),
  })

  const requests = Array.isArray(data) ? data : []
  const tenants = Array.isArray(tenantsData) ? tenantsData : []

  const approveMutation = useMutation({
    mutationFn: () => approveAccessRequest(approving._id, form),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Request approved')
      setApproving(null)
      setForm({ tenantId: '', role: 'staff', password: 'Nepal@123', note: '' })
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to approve request'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectAccessRequest(rejecting._id, { note: rejectNote }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Request rejected')
      setRejecting(null)
      setRejectNote('')
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reject request'),
  })

  const openApprove = (req) => {
    setForm({
      tenantId: req.tenantId ? String(req.tenantId) : '',
      role: req.requestedRole || 'staff',
      password: 'Nepal@123',
      note: '',
    })
    setApproving(req)
  }

  const filterBtn = (value, label) => (
    <button
      key={value}
      onClick={() => setStatus(value)}
      className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${status === value ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Access Requests" subtitle="Review registration and password reset requests">
        <Button variant="outline" size="sm" onClick={refetch} icon={<RefreshCw size={14} />}>Refresh</Button>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {filterBtn('pending', 'Pending')}
            {filterBtn('approved', 'Approved')}
            {filterBtn('rejected', 'Rejected')}
            {filterBtn('', 'All')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Type:</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="">All</option>
              <option value="registration">Registration</option>
              <option value="password_reset">Password Reset</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={4} type="row" />
        ) : error ? (
          <EmptyState
            icon={Inbox}
            title="Failed to load requests"
            description={error.message}
            action={{ label: 'Retry', onClick: refetch }}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No requests found"
            description="New registration and password reset requests submitted from the login page will appear here."
          />
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const TypeIcon = TYPE_ICONS[req.type] || UserPlus
              return (
                <div key={req._id} className="rounded-xl border border-[var(--color-border)] p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <TypeIcon size={12} /> {TYPE_LABELS[req.type] || req.type}
                        </span>
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 font-medium text-[var(--color-text)]">{req.name}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{req.email}{req.phone ? ` · ${req.phone}` : ''}</p>
                      {req.requestedRole && req.type === 'registration' && (
                        <p className="text-xs text-gray-400 mt-0.5">Requested role: {req.requestedRole}</p>
                      )}
                      {req.message && (
                        <p className="mt-2 text-sm text-gray-500 bg-[var(--color-elevated)] rounded-lg px-3 py-2">{req.message}</p>
                      )}
                      {req.reviewNote && (
                        <p className="mt-2 text-xs text-gray-400">Review note: {req.reviewNote}</p>
                      )}
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <Button size="sm" onClick={() => openApprove(req)} icon={<CheckCircle2 size={14} />}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejectNote(''); setRejecting(req) }} icon={<XCircle size={14} />}>Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!approving}
        onClose={() => setApproving(null)}
        title={approving?.type === 'registration' ? 'Approve Registration' : 'Approve Password Reset'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button loading={approveMutation.isPending} onClick={() => approveMutation.mutate()} icon={<CheckCircle2 size={14} />}>Approve</Button>
          </>
        }
      >
        {approving && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--color-elevated)] p-3 text-sm">
              <p className="font-medium">{approving.name}</p>
              <p className="text-[var(--color-text-secondary)]">{approving.email}</p>
            </div>

            {approving.type === 'registration' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tenant / Shop</label>
                  <select
                    value={form.tenantId}
                    onChange={(e) => setForm(f => ({ ...f, tenantId: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  >
                    <option value="">Select a tenant...</option>
                    {tenants.map(t => (
                      <option key={t._id} value={t.tenantNumber}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="qr_lookup">QR Lookup</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {approving.type === 'registration' ? 'Initial password' : 'New password'}
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <p className="text-xs text-gray-400 mt-1">
                {approving.type === 'registration'
                  ? 'The user will sign in with this password once approved.'
                  : 'The user will sign in with this new password. Share it with them after approval.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
              <textarea
                rows={2}
                value={form.note}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Add a note about this decision"
                className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-y"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject Request"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" loading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()} icon={<XCircle size={14} />}>Reject</Button>
          </>
        }
      >
        {rejecting && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--color-elevated)] p-3 text-sm">
              <p className="font-medium">{rejecting.name}</p>
              <p className="text-[var(--color-text-secondary)]">{rejecting.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reason (optional)</label>
              <textarea
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Why is this request being rejected?"
                className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-y"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
