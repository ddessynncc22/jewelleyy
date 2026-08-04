import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, ArrowLeft, Save, Mail, Phone, MapPin, Hash, Tag, ToggleLeft, ToggleRight } from 'lucide-react'
import { getTenantById, updateTenant } from '../../services/tenantService'
import { toggleTenantStatus } from '../../services/adminService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import PlanBadge, { PLAN_OPTIONS } from '../../components/ui/PlanBadge'
import TenantUsers from '../../components/admin/TenantUsers'
import { formatDate } from '../../utils/helpers'

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenantById(id).then(r => r.data.data || r.data),
  })

  const tenant = data
  const [form, setForm] = useState(null)
  const isEditing = form !== null

  const mutation = useMutation({
    mutationFn: (data) => updateTenant(id, data),
    onSuccess: () => { toast.success('Tenant updated'); setForm(null); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const toggleMutation = useMutation({
    mutationFn: () => toggleTenantStatus(id),
    onSuccess: (res) => {
      const msg = res.data?.message || (res.data?.data?.isActive ? 'Activated' : 'Deactivated')
      toast.success(msg)
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Toggle failed'),
  })

  if (isLoading) return <LoadingSkeleton count={4} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!tenant) return <ErrorState message="Tenant not found" onRetry={() => navigate('/admin/tenants')} />

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const startEdit = () => setForm({
    name: tenant.name, contactEmail: tenant.contactEmail || '',
    contactPhone: tenant.contactPhone || '', address: tenant.address || '',
    storeName: tenant.storeName || '', vatNumber: tenant.vatNumber || '',
    planType: tenant.planType || 'standard',
    businessStartDate: tenant.businessStartDate ? new Date(tenant.businessStartDate).toISOString().split('T')[0] : '',
  })

  const fields = [
    { label: 'Tenant Name', value: tenant.name, name: 'name' },
    { label: 'Slug', value: tenant.slug },
    { label: 'Store Name', value: tenant.storeName, name: 'storeName' },
    { label: 'Contact Email', value: tenant.contactEmail, name: 'contactEmail', icon: Mail },
    { label: 'Contact Phone', value: tenant.contactPhone, name: 'contactPhone', icon: Phone },
    { label: 'Address', value: tenant.address, name: 'address', icon: MapPin },
    { label: 'VAT Number', value: tenant.vatNumber, name: 'vatNumber', icon: Hash },
    { label: 'Plan', value: tenant.planType, name: 'planType', icon: Tag, render: () => <PlanBadge plan={tenant.planType} /> },
    { label: 'Business Start Date', value: tenant.businessStartDate ? formatDate(tenant.businessStartDate) : '—', name: 'businessStartDate' },
    { label: 'Currency', value: tenant.currency },
    { label: 'Status', value: tenant.isActive !== false ? 'Active' : 'Inactive' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={tenant.name} subtitle="Tenant details and settings">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tenants')} icon={<ArrowLeft size={14} />}>Back</Button>
      </PageHeader>

      <Card>
        {!isEditing ? (
          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.label} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                {f.icon && <f.icon size={16} className="text-gray-400 shrink-0" />}
                <span className="text-sm text-gray-500 w-32 shrink-0">{f.label}</span>
                <span className="text-sm font-medium">{f.render ? f.render() : (f.value || '\u2014')}</span>
              </div>
            ))}
            <div className="pt-4 flex gap-3">
              <Button onClick={startEdit} icon={<Save size={14} />}>Edit</Button>
              <Button onClick={() => toggleMutation.mutate()} variant={tenant.isActive !== false ? 'danger' : 'secondary'} loading={toggleMutation.isPending} icon={tenant.isActive !== false ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}>
                {tenant.isActive !== false ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="space-y-4">
            {['name', 'storeName', 'contactEmail', 'contactPhone', 'address', 'vatNumber'].map(field => (
              <div key={field}>
                <label className="block text-sm font-medium mb-1 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                <input name={field} value={form[field] || ''} onChange={handleChange}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan</label>
                <select name="planType" value={form.planType || 'standard'} onChange={handleChange}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2">
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Start Date</label>
                <input name="businessStartDate" type="date" value={form.businessStartDate || ''} onChange={handleChange}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={mutation.isPending}><Save size={14} /> Save</Button>
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      <TenantUsers tenantId={id} />
    </div>
  )
}
