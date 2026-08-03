import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import toast from 'react-hot-toast'

import { ClipboardCheck, RotateCcw } from 'lucide-react'

import { getStockReconciliation } from '../../services/auditService'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import Card from '../../components/ui/Card'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'
const columns = [
  {
    key: 'item',
    label: 'Item',
    render: (v) => v?.itemName || v?.SKU || '-',
  },
  {
    key: 'expectedQuantity',
    label: 'Net Movement Qty',
    render: (v) => (
      <span className={v <= 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{v}</span>
    ),
  },
  {
    key: 'note',
    label: 'Issue',
    render: (v) => v || '-',
  },
]

export default function StockReconciliation() {
  const [run, setRun] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const result = await getStockReconciliation()
      toast.success('Reconciliation completed')
      return result
    },
    enabled: run,
  })
  const handleRun = () => setRun(true)
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Reconciliation"
        subtitle="Compare system vs expected stock"
        icon={<ClipboardCheck size={24} />}
      >
        <Button onClick={handleRun} loading={isLoading} icon={<RotateCcw size={14} />}>
          {run ? 'Re-run' : 'Run Reconciliation'}
        </Button>
      </PageHeader>
      {!run ? (
        <Card>
          <p className="text-gray-500">Click &quot;Run Reconciliation&quot; to compare system stock against expected quantities.</p>
        </Card>
      ) : isLoading ? (
        <LoadingSkeleton count={3} type="table" />
      ) : (
        <Card>
          <DataTable columns={columns} data={data?.data?.discrepancies || []} loading={false} />
        </Card>
      )}
    </div>
  )
}

