import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth-helpers";
import { getAlertsFeed } from "@/lib/alerts-feed";
import { AlertasExplorer } from "./_components/alertas-explorer";

export default async function AlertasPage() {
  await requireUser();
  const { items, opticas, periodos } = await getAlertsFeed();

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Todos los hallazgos de auditoría. Filtra por óptica, severidad, tipo o período haciendo clic."
      />
      <AlertasExplorer items={items} opticas={opticas} periodos={periodos} />
    </>
  );
}
