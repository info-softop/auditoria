import { requireUser } from "@/lib/auth-helpers";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SidebarNav user={user} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
