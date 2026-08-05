import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Search, AlertTriangle, Boxes, Weight, IndianRupee, Gem, Layers } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import { formatCurrency, formatWeight, formatDate } from '../../utils/helpers';

const metaLabel = (m) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : '-');

export default function CurrentStockReport({ reportBody, onExport }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const items = useMemo(() => reportBody?.items || [], [reportBody]);
  const totalValue = reportBody?.totalValue ?? 0;
  const goldValue = reportBody?.goldValue ?? 0;
  const silverValue = reportBody?.silverValue ?? 0;
  const totalWeight = reportBody?.totalWeight ?? 0;
  const totalItems = reportBody?.totalItems ?? items.length;
  const zeroStockCount = reportBody?.zeroStockCount ?? 0;
  const lowStockThreshold = reportBody?.lowStockThreshold ?? 5;
  const rateInfo = reportBody?.rateInfo || {};

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.SKU, i.itemName, i.category, i.metalType].some((v) => v && String(v).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const categorySubtotals = useMemo(() => {
    const map = new Map();
    filtered.forEach((i) => {
      const key = i.category || 'Uncategorized';
      const cur = map.get(key) || { category: key, count: 0, weight: 0, value: 0 };
      cur.count += i.quantity || 1;
      cur.weight += (i.netMetalWeight || 0) * (i.quantity || 1);
      cur.value += i.estimatedValue || 0;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [filtered]);

  const columns = [
    { key: 'SKU', label: 'SKU', render: (val) => val || '-' },
    {
      key: 'itemName',
      label: 'Item Name',
      render: (val, row) => (
        <span className="inline-flex items-center gap-1.5">
          {val || '-'}
          {row.isLot && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Loose</span>}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => metaLabel(val),
    },
    { key: 'metalType', label: 'Metal Type', render: (val) => metaLabel(val) },
    { key: 'purity', label: 'Purity', render: (val) => val || '-' },
    { key: 'karat', label: 'Karat', render: (val) => (val ? `${val}K` : '-') },
    {
      key: 'quantity',
      label: 'Qty',
      render: (val, row) => (
        <span className={row.isLowStock ? 'font-semibold text-red-600' : ''}>
          {val ?? '-'}
        </span>
      ),
    },
    { key: 'netMetalWeight', label: 'Net Wt (g)', render: (val) => formatWeight(val) },
    { key: 'currentRate', label: 'Rate/g', render: (val) => (val ? `Rs ${Number(val).toLocaleString('en-IN')}` : '-') },
    { key: 'estimatedValue', label: 'Estimated Value', render: (val) => formatCurrency(val) },
    {
      key: 'valueShare',
      label: 'Value %',
      render: (val) => `${Number(val || 0).toFixed(1)}%`,
    },
    {
      key: 'flags',
      label: 'Flag',
      sortable: false,
      render: (_, row) => {
        if (row.isLowStock && row.quantity > 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> Low stock</span>;
        if (row.isLowStock) return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> Out of stock</span>;
        if (row.valuationIssue) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle className="h-3 w-3" /> Missing data</span>;
        return <span className="text-xs text-gray-400">OK</span>;
      },
    },
  ];

  const rowClassName = (row) => {
    if (row.isLowStock) return 'bg-red-50/60';
    if (row.valuationIssue) return 'bg-amber-50/60';
    return '';
  };

  const goldRate = rateInfo.gold?.perGram;
  const silverRate = rateInfo.silver?.perGram;
  const asOfDate = rateInfo.gold?.date || rateInfo.silver?.date || new Date();
  const rateSource = (r) => (r?.sourceUnit === 'gram' ? 'per-gram rate' : 'tola rate');

  return (
    <div className="space-y-6">
      <PageHeader title="Current Stock Report" subtitle={`Valuation as of ${formatDate(asOfDate)}`}>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      {zeroStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {zeroStockCount} item{zeroStockCount > 1 ? 's' : ''} with status "In Stock" has 0 quantity
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm shadow-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
          <Gem className="h-4 w-4" />
          Gold: Rs {goldRate ? Number(goldRate).toLocaleString('en-IN') : '—'}/g
          <span className="text-xs font-normal text-gray-500">
            ({goldRate ? rateSource(rateInfo.gold) : 'no rate'})
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
          <Gem className="h-4 w-4" />
          Silver: Rs {silverRate ? Number(silverRate).toLocaleString('en-IN') : '—'}/g
          <span className="text-xs font-normal text-gray-500">
            ({silverRate ? rateSource(rateInfo.silver) : 'no rate'})
          </span>
        </span>
        <span className="ml-auto text-xs text-gray-500">
          Value = net weight × rate/g × purity/1000
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Total Items" value={totalItems} icon={Boxes} color="blue" />
        <StatCard title="Net Metal Weight" value={formatWeight(totalWeight)} icon={Weight} color="purple" />
        <StatCard title="Gold Value" value={formatCurrency(goldValue)} icon={Gem} color="gold" />
        <StatCard title="Silver Value" value={formatCurrency(silverValue)} icon={Gem} color="gray" />
        <StatCard title="Total Value" value={formatCurrency(totalValue)} icon={IndianRupee} color="green" />
      </div>

      {categorySubtotals.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--color-text-secondary)]" />
            <h3 className="text-sm font-semibold">Category Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
              <thead>
                <tr className="bg-[var(--color-elevated)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Net Wt (g)</th>
                  <th className="px-4 py-2.5">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {categorySubtotals.map((c) => (
                  <tr key={c.category}>
                    <td className="px-4 py-2 capitalize">{c.category}</td>
                    <td className="px-4 py-2">{c.count}</td>
                    <td className="px-4 py-2">{formatWeight(c.weight)}</td>
                    <td className="px-4 py-2">{formatCurrency(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU, name, category…"
            className="w-full rounded-lg border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          loading={false}
          rowClassName={rowClassName}
          onRowClick={(row) => row._id && navigate(row.isLot ? `/loose-lots/${row._id}` : `/items/${row._id}`)}
        />
        <p className="mt-2 text-xs text-gray-400">
          Low stock = quantity ≤ {lowStockThreshold} · Red rows: low/out of stock · Amber rows: missing purity or net weight
        </p>
      </Card>
    </div>
  );
}
