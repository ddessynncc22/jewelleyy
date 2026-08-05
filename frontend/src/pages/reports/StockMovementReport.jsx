import { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Package,
  Layers,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatWeight, formatWeightLaal } from '../../utils/helpers';

const TYPE_LABELS = { stockIn: 'Stock In', stockOut: 'Stock Out' };

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function StockMovementReport({ reportBody, onExport }) {
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const movements = useMemo(() => reportBody?.movements || [], [reportBody]);

  const categories = useMemo(() => {
    const set = new Set();
    movements.forEach((m) => set.add(m.category));
    return Array.from(set).sort();
  }, [movements]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (type !== 'all' && m.type !== type) return false;
      if (category !== 'all' && m.category !== category) return false;
      if (q) {
        const hay = [m.itemName, m.itemSKU, m.category, m.notes, m.reference, m.performedBy?.name]
          .map((v) => (v || '').toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [movements, type, category, query]);

  const stats = useMemo(() => {
    const inRows = filtered.filter((m) => m.type === 'stockIn');
    const outRows = filtered.filter((m) => m.type === 'stockOut');
    const sumW = (rows) => rows.reduce((s, m) => s + (m.weight || 0), 0);
    const sumP = (rows) => rows.reduce((s, m) => s + (m.quantity || 0), 0);
    return {
      totalIn: sumW(inRows),
      totalOut: sumW(outRows),
      piecesIn: sumP(inRows),
      piecesOut: sumP(outRows),
      looseCount: filtered.filter((m) => m.isLoose).length,
    };
  }, [filtered]);

  const columns = [
    {
      key: 'movementDate',
      label: 'Date',
      render: (val) => <span className="whitespace-nowrap text-xs">{fmtDate(val)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <StatusBadge status={TYPE_LABELS[val] || val} />
      ),
    },
    { key: 'category', label: 'Category', render: (val) => val || '-' },
    {
      key: 'itemName',
      label: 'Item / Lot',
      render: (val, row) => (
        <div>
          <span className="font-medium text-gray-900">{val || '-'}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">{row.itemSKU || ''}</span>
            {row.isLoose && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-px text-[10px] font-semibold text-purple-700">
                Loose
              </span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'quantity', label: 'Qty', render: (val) => val ?? 0 },
    {
      key: 'weight',
      label: 'Weight',
      render: (val, row) => (
        <div className="whitespace-nowrap text-xs">
          {formatWeight(val)}
          <span className="text-gray-400"> · {formatWeightLaal(row.weightInLaal)} laal</span>
        </div>
      ),
    },
    { key: 'purity', label: 'Purity', render: (val) => (val ? `${val}‰` : '-') },
    { key: 'reference', label: 'Reference', render: (val) => val || '-' },
    {
      key: 'notes',
      label: 'Notes',
      render: (val) => <span className="max-w-[220px] truncate block" title={val}>{val || '-'}</span>,
    },
    { key: 'performedBy', label: 'Performed By', render: (val) => (val?.name ? val.name : '-') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movement Report" subtitle="All stock in and out activity, including loose lots">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Stock In" value={`${formatWeight(stats.totalIn)} g`} icon={ArrowDownCircle} color="green" />
        <StatCard title="Stock Out" value={`${formatWeight(stats.totalOut)} g`} icon={ArrowUpCircle} color="red" />
        <StatCard title="Net Movement" value={`${formatWeight(stats.totalIn - stats.totalOut)} g`} icon={ArrowLeftRight} color="blue" />
        <StatCard title="Pieces In / Out" value={`${stats.piecesIn} / ${stats.piecesOut}`} icon={Package} color="purple" />
        <StatCard title="Loose Movements" value={stats.looseCount} icon={Layers} color="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item, lot, reference…"
            className="pl-8 pr-3 py-1.5 border rounded-lg text-sm w-64"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white"
        >
          <option value="all">All Types</option>
          <option value="stockIn">Stock In</option>
          <option value="stockOut">Stock Out</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="self-center text-xs text-gray-500">{filtered.length} of {movements.length} movements</span>
      </div>

      <Card>
        <DataTable columns={columns} data={filtered} loading={false} />
      </Card>
    </div>
  );
}
