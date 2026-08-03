import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { RotateCcw } from 'lucide-react'

import { getInventoryLog } from '../../services/auditService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'
const columns = [
  { key: 'movementDate', label: 'Date', render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
  { key: 'item', label: 'Item', render: (v) => v?.itemName || v?.name || '-' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'weight', label: 'Weight' },
  { key: 'performedBy', label: 'User', render: (v) => v?.name || 'System' },
]

export default function InventoryLog() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({})
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-log', page, filters],
    queryFn: () => getInventoryLog({ page, limit: 20, ...filters }),
  })
  if (isLoading) return <LoadingSkeleton count={4} type="table" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Log" subtitle="Track all inventory changes">
        <Button variant="outline" size="sm" onClick={() => refetch()} icon={<RotateCcw size={14} />}>Refresh</Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={false}
        pagination={{
          page: data?.pagination?.page || 1,
          limit: data?.pagination?.limit || 20,
          total: data?.pagination?.total || 0,
          totalPages: data?.pagination?.totalPages || 1,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}

