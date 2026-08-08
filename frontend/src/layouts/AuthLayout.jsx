import { Outlet } from "react-router-dom";

import { Sparkles } from "lucide-react";

import { useHostContext } from "../hooks/useHostContext";

export default function AuthLayout() {
  const { shop, isShopHost } = useHostContext();

  // On a shop subdomain the sign-in page identifies the shop, so staff can tell
  // at a glance they are at the right address.
  const title = isShopHost && shop ? shop.storeName || shop.name : "Jewelcore";
  const subtitle = isShopHost && shop ? "Shop Sign In" : "Inventory Management System";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          {isShopHost && shop?.logoUrl ? (
            <img
              src={shop.logoUrl}
              alt={title}
              className="mx-auto mb-4 inline-block h-16 w-16 rounded-2xl object-cover shadow-[var(--shadow-md)]"
            />
          ) : (
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-gold-600)] text-white shadow-[var(--shadow-md)]">
              <Sparkles className="h-8 w-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-7 shadow-[var(--shadow-md)]">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
          &copy; {new Date().getFullYear()} Jewelcore
        </p>
      </div>
    </div>
  );
}