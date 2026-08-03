import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Search, Users, Briefcase, ArrowDownUp, Undo2, Weight } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatWeight } from '../../utils/helpers';

export default function KarigarReport({ reportBody, onExport }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const items = useMemo(() => reportBody?.items || [], [reportBody]);
  const summary = useMemo(() => reportBody?.summary || {}, [reportBody]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.name, i.phone, i.specialization, i.address].some((v) => v && String(v).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const columns = [
    { key: 'name', label: 'Name', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'phone', label: 'Phone', render: (val) => val || '-' },
    { key: 'specialization', label: 'Specialization', render: (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : '-') },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) => <StatusBadge status={val ? 'Active' : 'Inactive'} />,
    },
    { key: 'pendingJobs', label: 'Pending Jobs', render: (val) => val ?? 0 },
    { key: 'totalIssued', label: 'Issued', render: (val) => val ?? 0 },
    { key: 'totalReturned', label: 'Returned', render: (val) => val ?? 0 },
    { key: 'outstandingCount', label: 'Outstanding', render: (val) => val ?? 0 },
    { key: 'outstandingWeight', label: 'Out Wt (g)', render: (val) => formatWeight(val) },
    {
      key: 'returnRate',
      label: 'Return %',
      render: (val) => `${Number(val || 0).toFixed(1)}%`,
    },
  ];

  const rowClassName = (row) => {
    if (row.outstandingCount > 0) return 'bg-red-50/60';
    if (row.pendingJobs > 0) return 'bg-amber-50/60';
    return '';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Karigar Report" subtitle="Materials out with karigars and job status">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Total Karigars" value={summary.totalKarigars ?? 0} icon={Users} color="blue" />
        <StatCard title="Pending Jobs" value={summary.totalPendingJobs ?? 0} icon={Briefcase} color="purple" />
        <StatCard title="Materials Issued" value={summary.totalIssued ?? 0} icon={ArrowDownUp} color="green" />
        <StatCard title="Materials Outstanding" value={summary.totalOutstanding ?? 0} icon={Undo2} color="yellow" />
        <StatCard title="Outstanding Weight" value={formatWeight(summary.totalOutstandingWeight)} icon={Weight} color="red" />
      </div>

      <Card>
        <div className="mb-3 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, specialization…"
            className="w-full rounded-lg border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          loading={false}
          rowClassName={rowClassName}
          onRowClick={(row) => row._id && navigate(`/karigar/${row._id}`)}
        />
        <p className="mt-2 text-xs text-gray-400">
          Red rows: materials still out with the karigar · Amber rows: has pending jobs
        </p>
      </Card>
    </div>
  );
}
