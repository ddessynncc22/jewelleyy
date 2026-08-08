import { AlertTriangle, RefreshCw } from "lucide-react";

const ErrorState = ({ message = "Something went wrong", onRetry }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-up">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10">
      <AlertTriangle className="h-8 w-8 text-danger" />
    </div>
    <h3 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Error</h3>
    <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-sm">
      {message}
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    )}
  </div>
);
export default ErrorState;