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
      {/* ambient gold glows */}
      <div className="pointer-events-none absolute -top-32 -right-20 h-[480px] w-[480px] rounded-full bg-[var(--color-gold-200)]/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-[var(--color-gold-300)]/20 blur-3xl" />

      {/* Brand / info panel */}
      <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[var(--color-ink-900)] via-[var(--color-ink-800)] to-[var(--color-ink-900)] p-12 lg:flex xl:p-16">
        {/* gold sheen */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 420px at 20% 0%, rgba(217,180,90,0.22), transparent 60%), radial-gradient(600px 500px at 90% 100%, rgba(185,141,47,0.18), transparent 55%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-gold text-white shadow-[var(--shadow-gold-lg)]">
            <Gem className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Jewelcore
          </span>
          <span className="ml-auto rounded-full border border-gold-300/30 bg-gold-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-300">
            Aurum Suite
          </span>
        </div>

        <div className="relative max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Jewellery management,
            <span className="text-gradient-gold"> made simple.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-300">
            One system for inventory, sales, karigar jobs and customer khaata,
            built for the Nepali market.
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-white shadow-[var(--shadow-gold)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-white">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-ink-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400" />
          Grams &amp; tola · NPR · Multi-shop
        </div>
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
                className="mx-auto mb-4 inline-block h-14 w-14 rounded-2xl object-cover shadow-[var(--shadow-md)] ring-1 ring-[var(--color-gold-200)]"
              />
            ) : (
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-white shadow-[var(--shadow-gold-lg)]">
                <Gem className="h-7 w-7" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{tagline}</p>
          </div>

          <div className="relative animate-fade-up rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-lg)] ring-1 ring-black/[0.02]">
            <div
              className="pointer-events-none absolute -top-12 right-0 h-40 w-40 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(217,180,90,0.18), transparent 70%)" }}
            />
            <div className="relative">
              <Outlet />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
            &copy; {new Date().getFullYear()} Jewelcore
          </p>
        </div>
      </main>
    </div>
  );
}