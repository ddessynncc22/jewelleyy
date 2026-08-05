import { Outlet } from "react-router-dom";

import { Sparkles } from "lucide-react";

import { useHostContext } from "../hooks/useHostContext";

export default function AuthLayout() {
  const { shop, isShopHost } = useHostContext();

  // On a shop subdomain the sign-in page identifies the shop, so staff can tell
  // at a glance they are at the right address.
  const title = isShopHost && shop ? shop.storeName || shop.name : "Core";
  const subtitle = isShopHost && shop ? "Shop Sign In" : "Inventory Management System";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {isShopHost && shop?.logoUrl ? (
            <img
              src={shop.logoUrl}
              alt={title}
              className="inline-block w-16 h-16 rounded-2xl object-cover shadow-lg shadow-[var(--color-primary)]/20 mb-4"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-amber-700/70 mt-1">{subtitle}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl shadow-amber-500/10 border border-amber-200/50 p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]" />
          <Outlet />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Core
        </p>
      </div>
    </div>
  );
}
