"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Search,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";

import { cn, getInitials } from "@/lib/utils";
import { useClients } from "@/hooks/use-clients";
import { placeholderClients } from "@/lib/placeholder";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/communications", label: "Communications", icon: Mail },
];

function withClient(href: string, clientId: string | null) {
  return clientId ? `${href}?client_id=${clientId}` : href;
}

export function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const selectedClientId = sp.get("client_id");
  const [search, setSearch] = useState("");

  const { data: realClients, isLoading: clientsLoading } = useClients(search);
  const clients =
    !clientsLoading && (realClients?.length ?? 0) === 0
      ? placeholderClients.filter((c) =>
          search ? c.name.toLowerCase().includes(search.toLowerCase()) : true,
        )
      : (realClients ?? []);
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[var(--brand)] text-[var(--brand-foreground)] lg:flex">
      <div className="px-5 pt-5 pb-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold">
            MS
          </div>
          <span className="text-base font-semibold tracking-tight">MySigrid</span>
        </Link>
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">
            Clients
          </span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            {clients?.length ?? 0}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-md bg-white/10 py-1.5 pr-2 pl-8 text-theme-sm text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none"
          />
        </div>
      </div>

      <ul className="custom-scrollbar mt-2 flex max-h-64 flex-col gap-0.5 overflow-y-auto px-3">
        {(clients ?? []).slice(0, 20).map((c) => {
          const active = selectedClientId === c.id;
          return (
            <li key={c.id}>
              <Link
                href={`${pathname}?client_id=${c.id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-theme-sm transition-colors",
                  active
                    ? "bg-white text-gray-900 shadow-theme-xs"
                    : "text-white/90 hover:bg-white/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                    active
                      ? "bg-brand-100 text-[var(--brand)]"
                      : "bg-white/15 text-white",
                  )}
                >
                  {getInitials(c.name)}
                </div>
                <span className="truncate">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="px-5 pt-5 pb-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">
          Menu
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={withClient(item.href, selectedClientId)}
              className={cn(
                "menu-item",
                active ? "menu-item-active" : "menu-item-inactive",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          className="menu-item menu-item-inactive w-full"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="flex-1 text-left">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
