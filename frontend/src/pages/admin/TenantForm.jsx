import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2 } from 'lucide-react'
import { onboardTenant } from '../../services/tenantService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

export default function TenantForm() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    tenantName: '', slug: '', adminName: '', adminEmail: '', adminPassword: '', adminPhone: '',
    contactEmail: '', contactPhone: '', address: '', storeName: '', planType: 'standard', businessStartDate: '',
  })

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await onboardTenant(form)
      toast.success(`Tenant "${res.data.data.tenant.name}" created`)
      navigate('/admin')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="New Tenant" subtitle="Create a new shop with admin account" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-1">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tenant Name *</label>
            <input name="tenantName" value={form.tenantName} onChange={handleChange} required className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2" placeholder="e.g. Kushal Jewellers" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Slug (optional)</label>
              <input name="slug" value={form.slug} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm" placeholder="Auto-generated if empty" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Store Name</label>
              <input name="storeName" value={form.storeName} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm" placeholder="Defaults to tenant name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Plan</label>
              <select name="planType" value={form.planType} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Business Start Date</label>
              <input name="businessStartDate" value={form.businessStartDate} onChange={handleChange} type="date" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
          </div>

          <hr className="border-gray-200" />
          <h3 className="text-sm font-semibold text-gray-700">Admin User</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Name *</label>
              <input name="adminName" value={form.adminName} onChange={handleChange} required className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Email *</label>
              <input name="adminEmail" value={form.adminEmail} onChange={handleChange} required type="email" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Password *</label>
              <input name="adminPassword" value={form.adminPassword} onChange={handleChange} required type="password" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Phone</label>
              <input name="adminPhone" value={form.adminPhone} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
          </div>

          <hr className="border-gray-200" />
          <h3 className="text-sm font-semibold text-gray-700">Contact Info</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Contact Email</label>
              <input name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Contact Phone</label>
              <input name="contactPhone" value={form.contactPhone} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Address</label>
            <input name="address" value={form.address} onChange={handleChange} className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading} icon={<Building2 size={14} />}>Create Tenant</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
