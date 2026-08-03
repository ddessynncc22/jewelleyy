import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, RefreshCw } from "lucide-react";
import { getDeletedRecords } from "../../services/auditService";
import DataTable from "../../components/ui/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorState from "../../components/ui/ErrorState";
const columns = [
  { key: "module", label: "Module" },
  {
    key: "description",
    label: "Record",
    render: (v) => v || "-",
  },
  {
    key: "performedBy",
    label: "Deleted By",
    render: (v) => v?.name || "System",
  },
  {
    key: "createdAt",
    label: "Deleted At",
    render: (v) => (v ? new Date(v).toLocaleString() : "-"),
  },
];

export default function DeletedRecords() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deleted-records", page],
    queryFn: () => getDeletedRecords({ page, limit: 20 }),
  });
  if (isLoading)
return <LoadingSkeleton count={4} type="table" />;
  if (error)
return <ErrorState message={error.message} onRetry={refetch} />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Deleted Records"
        subtitle="View soft-deleted records"
        icon={<Trash2 size={24} />}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          icon={<RefreshCw size={14} />}
        >
          Refresh
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data?.data?.recentDeleteLogs || []}
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
  );
}
