"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { formatCOP, formatFecha } from "@/lib/format";
import {
  Landmark,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";

interface Mov {
  fecha: string | null;
  descripcion: string;
  valor: number;
  tipo: "INGRESO" | "EGRESO";
  origen?: string;
}
interface Result {
  ok: true;
  columnasDetectadas: { fecha: string; descripcion: string; valor: string };
  movimientosExtracto: number;
  conciliados: { softop: Mov; banco: Mov; difValor: number }[];
  soloSoftop: Mov[];
  soloBanco: Mov[];
  resumen: {
    nConciliados: number;
    nSoloSoftop: number;
    nSoloBanco: number;
    montoConciliado: number;
  };
}

export function ExtractoDropzone({
  periodo,
  opticaId,
}: {
  periodo: string | null;
  opticaId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = useCallback(
    async (f: File) => {
      setFile(f);
      setError(null);
      setResult(null);
      if (!periodo) {
        setError("Selecciona un período antes de subir el extracto.");
        return;
      }
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("periodo", periodo);
        if (opticaId) fd.append("opticaId", opticaId);
        const res = await fetch("/api/conciliacion", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "No se pudo conciliar el extracto.");
          return;
        }
        setResult(json);
      } catch {
        setError("Error al procesar el extracto.");
      } finally {
        setLoading(false);
      }
    },
    [periodo, opticaId]
  );

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) run(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-16 text-center transition-colors ${
                dragging
                  ? "border-primary bg-accent/50"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="grid size-14 place-items-center rounded-full bg-accent text-primary">
                {loading ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : (
                  <Landmark className="size-7" />
                )}
              </div>
              <div>
                <p className="font-medium">Arrastra el extracto bancario aquí</p>
                <p className="text-sm text-muted-foreground">
                  Excel o CSV del banco — detectamos las columnas automáticamente
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) run(f);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-primary">
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  {result && (
                    <p className="text-xs text-muted-foreground">
                      {result.movimientosExtracto} movimientos · columnas:{" "}
                      {result.columnasDetectadas.fecha} ·{" "}
                      {result.columnasDetectadas.valor}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="size-4" /> Quitar
                </Button>
              </div>

              {error && (
                <Alert>
                  <TriangleAlert className="size-4" />
                  <AlertTitle>No se pudo conciliar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Conciliados"
              value={result.resumen.nConciliados}
              icon={CheckCircle2}
              tone="success"
              hint={formatCOP(result.resumen.montoConciliado)}
            />
            <KpiCard
              label="Solo en Softop"
              value={result.resumen.nSoloSoftop}
              icon={TriangleAlert}
              tone={result.resumen.nSoloSoftop > 0 ? "alta" : "default"}
              hint="Registrado pero ausente en el banco"
            />
            <KpiCard
              label="Solo en el banco"
              value={result.resumen.nSoloBanco}
              icon={TriangleAlert}
              tone={result.resumen.nSoloBanco > 0 ? "alta" : "default"}
              hint="En el extracto, sin registro en Softop"
            />
          </div>

          <MovTable
            title="Conciliados"
            empty="Sin coincidencias."
            rows={result.conciliados.map((c) => ({
              fecha: c.banco.fecha,
              descripcion: `${c.softop.descripcion}  ↔  ${c.banco.descripcion}`,
              valor: c.softop.valor,
              tipo: c.softop.tipo,
            }))}
            tone="ok"
          />
          {result.soloSoftop.length > 0 && (
            <MovTable
              title="Registrado en Softop, ausente en el banco"
              empty=""
              rows={result.soloSoftop}
              tone="alta"
            />
          )}
          {result.soloBanco.length > 0 && (
            <MovTable
              title="En el banco, sin registro en Softop"
              empty=""
              rows={result.soloBanco}
              tone="alta"
            />
          )}
        </>
      )}
    </div>
  );
}

function MovTable({
  title,
  rows,
  empty,
  tone,
}: {
  title: string;
  rows: Mov[];
  empty: string;
  tone: "ok" | "alta";
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
          {tone === "ok" ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <TriangleAlert className="size-4 text-sev-alta" />
          )}
          {title} ({rows.length})
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((m, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatFecha(m.fecha)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        {m.descripcion}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          m.tipo === "INGRESO" ? "text-success" : "text-sev-alta"
                        }
                      >
                        {m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums-fin whitespace-nowrap">
                      {formatCOP(m.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
