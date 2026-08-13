import { Outlet } from "react-router-dom";

import { Gem, Boxes, ShoppingCart, ShieldCheck } from "lucide-react";

import { useHostContext } from "../hooks/useHostContext";

const FEATURES = [
  { icon: Boxes, label: "Inventory & barcodes" },
  { icon: ShoppingCart, label: "POS billing & invoices" },
  { icon: ShieldCheck, label: "Reports & audit trails" },
];

export default function AuthLayout() {
  const { shop, isShopHost } = useHostContext();

  const title = isShopHost && shop ? shop.storeName || shop.name : "Jewelcore";
  const tagline = isShopHost && shop ? "Shop Sign In" : "Jewellery Management System";

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* soft ambient glow */}
      <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-[var(--color-gold-200)]/40 blur-3xl" />

      {/* Brand / info panel */}
      <aside className="relative hidden w-[45%] flex-col justify-between bg-white/60 p-12 backdrop-blur-sm lg:flex xl:p-16">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-gold-500)] to-[var(--color-gold-700)] text-white">
            <Gem className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
            Jewelcore
          </span>
        </div>

        <div className="max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] xl:text-4xl">
            Jewellery management,
            <span className="text-[var(--color-gold-600)]"> made simple.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            One system for inventory, sales, karigar jobs and customer khaata,
            built for the Nepali market.
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-gold-100)] text-[var(--color-gold-700)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)]">
          Grams &amp; tola · NPR · Multi-shop
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Compact brand header for mobile / shop hosts */}
          <div className="mb-8 text-center lg:hidden">
            {isShopHost && shop?.logoUrl ? (
              <img
                src={shop.logoUrl}
                alt={title}
                className="mx-auto mb-4 inline-block h-14 w-14 rounded-2xl object-cover shadow-[var(--shadow-md)]"
              />
            ) : (
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-gold-500)] to-[var(--color-gold-700)] text-white shadow-[var(--shadow-md)]">
                <Gem className="h-7 w-7" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{tagline}</p>
          </div>

          <div className="animate-fade-up rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-lg)]">
            <Outlet />
          </div>

          <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
            &copy; {new Date().getFullYear()} Jewelcore
          </p>
        </div>
      </main>
    </div>
  );
}
