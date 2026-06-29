/**
 * Layout PÚBLICO (sin login ni sidebar). Lo usan las rutas accesibles sin
 * sesión, como el registro de traslados por parte de las asesoras.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      {children}
    </div>
  );
}
