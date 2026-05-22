"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Moon,
  Phone,
  PhoneOff,
  Shield,
  Sun,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/use-clients";
import { placeholderClients } from "@/lib/placeholder";
import { cn, getInitials } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const sp = useSearchParams();
  const selectedClientId = sp.get("client_id");
  const { data: realClients, isLoading: clientsLoading } = useClients();
  const clients =
    !clientsLoading && (realClients?.length ?? 0) === 0
      ? placeholderClients
      : (realClients ?? []);
  const { data: session } = useSession();
  const user = session?.user;
  const userName = user?.name ?? "";
  const firstName = userName.split(" ")[0] || "";
  const { theme, setTheme } = useTheme();

  const selected = clients?.find((c) => c.id === selectedClientId) ?? null;

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account? This revokes Google access and permanently deletes your stored emails and tasks. This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await api.delete("/api/account");
      toast.success("Account deleted");
      signOut({ callbackUrl: "/sign-in" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const switchClient = (id: string | null) => {
    const params = new URLSearchParams(sp.toString());
    if (id) params.set("client_id", id);
    else params.delete("client_id");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  };

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        {selected ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => switchClient(null)}
              aria-label="Clear client filter"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-white">
              <div className="flex size-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold">
                {getInitials(selected.name)}
              </div>
              <span className="text-theme-sm font-medium">{selected.name}</span>
            </div>
          </>
        ) : (
          <span className="text-theme-sm text-gray-400">No client selected</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="size-4" />
              Other accounts
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Switch client</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {(clients ?? []).map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => switchClient(c.id)}
                  className={cn(
                    "gap-2",
                    c.id === selectedClientId && "bg-accent",
                  )}
                >
                  <div className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-[var(--brand)]">
                    {getInitials(c.name)}
                  </div>
                  <span className="truncate">{c.name}</span>
                </DropdownMenuItem>
              ))}
              {(!clients || clients.length === 0) && (
                <div className="px-2 py-3 text-center text-theme-xs text-gray-500">
                  No clients yet
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" aria-label="Calls offline">
          <PhoneOff className="size-4 text-gray-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Calls online"
          className="text-success-500"
        >
          <Phone className="size-4" />
        </Button>

        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-semibold text-white">
            0
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {getInitials(userName || firstName || "U")}
              </div>
              <span className="hidden text-theme-sm font-medium text-gray-800 sm:inline dark:text-gray-200">
                {userName || firstName || "User"}
              </span>
              <ChevronDown className="size-3.5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                {userName || "User"}
              </span>
              <span className="text-theme-xs font-normal text-gray-500">
                {user?.email ?? ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <UserCog className="size-4" />
              Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href="https://www.mysigrid.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Shield className="size-4" />
                Privacy Policy
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
            >
              <LogOut className="size-4" />
              Sign Out
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={handleDeleteAccount}
            >
              <Trash2 className="size-4" />
              Delete Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
