"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logout } from "@/app/actions/session";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";
import type { Role } from "@/generated/prisma";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  AUDITOR: "Auditor",
  VIEWER: "Lectura",
};

const STORAGE_KEY = "sidebar-collapsed";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  role: Role;
}

export function SidebarNav({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persistencia del estado colapsado entre navegaciones.
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(user.role));
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <BrandLogo variant="horizontal" height={22} priority />
            <span className="border-l pl-2.5 text-sm font-medium text-muted-foreground">
              Auditoría
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Ocultar menú"}
          title={collapsed ? "Expandir menú" : "Ocultar menú"}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4.5" />
          ) : (
            <PanelLeftClose className="size-4.5" />
          )}
        </button>
      </div>

      <nav
        className={cn(
          "flex-1 space-y-6 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="space-y-1">
              {collapsed ? (
                <div className="mx-2 mb-1 border-t border-sidebar-border/70" />
              ) : (
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </p>
              )}
              {groupItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-md text-sm transition-colors",
                      collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon
                      className={cn("size-4.5 shrink-0", active && "text-sidebar-primary")}
                    />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Usuario (pie del sidebar) */}
      <div className={cn("border-t", collapsed ? "p-2" : "p-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger
            title={collapsed ? (user.name ?? user.email ?? undefined) : undefined}
            className={cn(
              "flex w-full items-center rounded-md text-left outline-none transition-colors hover:bg-sidebar-accent/50 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
              <Badge variant="secondary" className="mt-1 w-fit">
                {ROLE_LABEL[user.role]}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={logout}>
              <button type="submit" className="w-full">
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="size-4" /> Cerrar sesión
                </DropdownMenuItem>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
