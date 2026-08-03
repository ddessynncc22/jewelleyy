import { useState } from 'react';

import { useParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import toast from 'react-hot-toast';

import { FileSpreadsheet, FileText } from 'lucide-react';

import {
  getCurrentStock,
  getStockMovement,
  getInventoryValuation,
  getKarigarReport,
  getCustomerLedgerReport,
  getProfitSummary,
  exportReport,
} from '../../services/reportService';

import PageHeader from '../../components/ui/PageHeader';

import DataTable from '../../components/ui/DataTable';

import Card from '../../components/ui/Card';

import StatCard from '../../components/ui/StatCard';

import Button from '../../components/ui/Button';

import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

import ErrorState from '../../components/ui/ErrorState';

import CurrentStockReport from './CurrentStockReport';

import KarigarReport from './KarigarReport';

const reportNames = {
  'current-stock': 'Current Stock Report',
  'stock-movement': 'Stock Movement Report',
  'valuation': 'Inventory Valuation',
  'karigar': 'Karigar Report',
  'customer-ledger': 'Customer Ledger Report',
  'profit-summary': 'Profit Summary',
};

const reportFns = {
  'current-stock': getCurrentStock,
  'stock-movement': getStockMovement,
  'valuation': getInventoryValuation,
  'karigar': getKarigarReport,
  'customer-ledger': getCustomerLedgerReport,
  'profit-summary': getProfitSummary,
};

const internalFields = new Set([
  '_id', '__v', 'isDeleted', 'deletedAt', 'deletedBy', 'tenantId',
  'certificates', 'priceHistory', 'linkedItems', 'updatedAt',
  'items', 'images', 'notes', 'tags', 'valuation', 'customer',
  'itemDetails', 'collateralPhotos', 'payments', 'materials',
  'password', 'token', 'refreshToken', 'barcode',
]);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatCell(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return `${val.length} item${val.length === 1 ? '' : 's'}`;
    const obj = val;
    if (obj.itemName) return obj.itemName;
    if (obj.name) return obj.name;
    if (obj.SKU) return obj.SKU;
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString();
  }
  return String(val);
}

export default function ReportView() {
  const { type } = useParams();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const params = {};
  if (dateRange.from) params.startDate = dateRange.from;
  if (dateRange.to) params.endDate = dateRange.to;

  const fetchFn = reportFns[type] || getCurrentStock;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report', type, dateRange],
    queryFn: () => fetchFn(params),
    enabled: !!type,
  });

  const handleExport = async (format) => {
    try {
      const res = await exportReport(type, { ...params, format });
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(blob, `${type}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed');
    }
  };

  if (isLoading) return <LoadingSkeleton count={4} type="card" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const responseData = data?.data;
  // backend wraps response in { success, data: actualBody, ... }
  const reportBody = responseData?.data ?? responseData;
  let reportData = [];

  if (type === 'current-stock') {
    reportData = reportBody?.items || [];
  } else if (type === 'stock-movement') {
    reportData = reportBody?.movements || [];
  } else if (type === 'pawn') {
    reportData = reportBody?.summary || [];
  } else {
    reportData = Array.isArray(reportBody) ? reportBody : reportBody ? [reportBody] : [];
  }

  const columns = reportData.length > 0
    ? Object.keys(reportData[0])
        .filter(k => !internalFields.has(k))
        .map(key => ({
          key,
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          render: formatCell,
        }))
    : [{ key: 'name', label: 'No data' }];

  const totalValue = reportBody?.totalValue ?? reportData.reduce(
    (s, r) => s + (r.costPrice || r.value || r.estimatedValue || r.totalRevenue || r.totalLoanAmount || 0),
    0,
  );

  if (type === 'current-stock') {
    return <CurrentStockReport reportBody={reportBody} onExport={handleExport} />;
  }

  if (type === 'karigar') {
    return <KarigarReport reportBody={reportBody} onExport={handleExport} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={reportNames[type] || 'Report'} subtitle="Filter and export your report">
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {type === 'stock-movement' ? (
          <>
            <StatCard title="Total Movements" value={reportData.length} color="blue" />
            <StatCard title="Stock In" value={`${(reportBody?.summary?.totalStockIn ?? 0).toFixed(2)} g`} color="green" />
            <StatCard title="Stock Out" value={`${(reportBody?.summary?.totalStockOut ?? 0).toFixed(2)} g`} color="red" />
            <StatCard title="Net Movement" value={`${((reportBody?.summary?.totalStockIn ?? 0) - (reportBody?.summary?.totalStockOut ?? 0)).toFixed(2)} g`} color="orange" />
          </>
        ) : (
          <>
            <StatCard title="Total Entries" value={reportData.length} color="blue" />
            <StatCard title="Total Value" value={`Rs. ${totalValue.toLocaleString()}`} color="green" />
          </>
        )}
      </div>

      <Card>
        <DataTable columns={columns} data={reportData} loading={false} />
      </Card>
    </div>
  );
}
