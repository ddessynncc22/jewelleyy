import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle, XCircle, Gem, TrendingUp, ClipboardList } from 'lucide-react'
import { getAdminStats } from '../../services/adminService'
import { getAccessRequests } from '../../services/adminService'
import { getLatestRates } from '../../services/rateService'
import { listTenants } from '../../services/tenantService'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Button from '../../components/ui/Button'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'

const TOLA_TO_GRAM = 11.664

export default function AdminDashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStats().then(r => r.data.data || r.data),
  })

  const { data: ratesData } = useQuery({
    queryKey: ['admin-latest-rates'],
    queryFn: () => getLatestRates().then(r => r.data.data || r.data),
    refetchInterval: 120000,
  })

  const { data: requestsData } = useQuery({
    queryKey: ['admin-pending-requests'],
    queryFn: () => getAccessRequests({ status: 'pending' }).then(r => r.data.data || r.data),
    refetchInterval: 60000,
  })

  const pendingRequests = Array.isArray(requestsData) ? requestsData.length : 0

  const gold = ratesData?.gold
  const silver = ratesData?.silver
  const goldPerGram = gold ? (gold.unit === 'gram' ? gold.rate : Math.round(gold.rate / TOLA_TO_GRAM)) : 0
  const silverPerGram = silver ? (silver.unit === 'gram' ? silver.rate : Math.round(silver.rate / TOLA_TO_GRAM)) : 0

  if (isLoading) return <LoadingSkeleton count={3} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel" subtitle="Tenant management overview">
        <Button onClick={() => navigate('/admin/tenants/new')} icon={<Building2 size={14} />}>New Tenant</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Tenants" value={stats?.totalTenants || 0} color="blue" icon={<Building2 size={18} />} />
        <StatCard title="Active" value={stats?.activeTenants || 0} color="green" icon={<CheckCircle size={18} />} />
        <StatCard title="Inactive" value={stats?.inactiveTenants || 0} color="red" icon={<XCircle size={18} />} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-200/60 text-amber-700">
              <Gem size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Gold Rate</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-900 card-value">
            {gold ? `Rs. ${gold.rate.toLocaleString()}` : '—'}
            {gold && <span className="text-sm font-normal text-amber-500 ml-1">/{gold.unit}</span>}
          </p>
          {goldPerGram > 0 && <p className="text-sm text-amber-700/70 mt-1">Rs. {goldPerGram.toLocaleString()} / gram</p>}
          {gold?.date && <p className="text-[10px] text-amber-400 mt-2">{new Date(gold.date).toLocaleDateString()}</p>}
        </div>

        <div className="rounded-2xl border border-gray-200/50 bg-gradient-to-br from-gray-50 to-slate-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-gray-200/60 text-gray-600">
              <Gem size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Silver Rate</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 card-value">
            {silver ? `Rs. ${silver.rate.toLocaleString()}` : '—'}
            {silver && <span className="text-sm font-normal text-gray-400 ml-1">/{silver.unit}</span>}
          </p>
          {silverPerGram > 0 && <p className="text-sm text-gray-500/70 mt-1">Rs. {silverPerGram.toLocaleString()} / gram</p>}
          {silver?.date && <p className="text-[10px] text-gray-400 mt-2">{new Date(silver.date).toLocaleDateString()}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Button onClick={() => navigate('/admin/tenants')} variant="outline" className="w-full justify-start" icon={<Building2 size={14} />}>
              Manage Tenants
            </Button>
            <Button onClick={() => navigate('/admin/tenants/new')} variant="outline" className="w-full justify-start" icon={<Building2 size={14} />}>
              Create New Tenant
            </Button>
            <Button onClick={() => navigate('/admin/requests')} variant="outline" className="w-full justify-start" icon={<ClipboardList size={14} />}>
              Review Requests
              {pendingRequests > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  {pendingRequests}
                </span>
              )}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Tenants</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tenants')}>View All</Button>
          </div>
          <RecentTenantsList />
        </Card>
      </div>
    </div>
  )
}

function RecentTenantsList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => listTenants().then(r => r.data.data || r.data),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>
  const tenants = Array.isArray(data) ? data.slice(0, 5) : []

  return (
    <div className="space-y-1">
      {tenants.map(t => (
        <div key={t._id} onClick={() => navigate(`/admin/tenants/${t._id}`)}
          className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{t.name}</p>
            <p className="text-xs text-gray-400 truncate">{t.contactEmail || t.slug}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${t.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {t.isActive !== false ? 'Active' : 'Inactive'}
          </span>
        </div>
      ))}
      {tenants.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No tenants</p>}
    </div>
  )
}
