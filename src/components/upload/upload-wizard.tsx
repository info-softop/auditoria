"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/severity-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Severidad } from "@/lib/audit-types";
import { formatPeriodo } from "@/lib/format";

interface Preview {
  tipoReporte: string;
  tipoLabel: string;
  periodos: string[];
  opticas: string[];
  totalFilas: number;
  filasConAlerta: number;
  opticaDetectada: { id: string; nombre: string; codigoInterno: string } | null;
  existentes: { periodo: string; optica: string; filas: number }[];
  preview: {
    rowIndex: number;
    data: Record<string, unknown>;
    alerts: { campo: string; severidad: Severidad; tipo: string; mensaje: string }[];
  }[];
}

export function UploadWizard({
  opticas,
}: {
  opticas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [opticaId, setOpticaId] = useState("");

  const analyze = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo analizar el archivo");
        setFile(null);
        return;
      }
      setPreview(json);
      setPeriodo(json.periodos[0] ?? "");
      if (json.opticaDetectada) setOpticaId(json.opticaDetectada.id);
    } catch {
      toast.error("Error al subir el archivo");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) analyze(f);
    },
    [analyze]
  );

  const commit = useCallback(async () => {
    if (!file || !preview) return;
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      toast.error("Selecciona un período válido (YYYY-MM).");
      return;
    }
    const needsOptica = preview.opticas.length === 0;
    if (needsOptica && !opticaId) {
      toast.error(
        "No se detectó la óptica por el nombre del archivo; selecciónala."
      );
      return;
    }
    setCommitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("periodo", periodo);
      if (needsOptica) fd.append("opticaId", opticaId);
      const res = await fetch("/api/upload/commit", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo confirmar la carga");
        return;
      }
      const ins = json.insertadas ?? 0;
      const dup = json.duplicadas ?? 0;
      if (ins === 0 && dup > 0) {
        toast.info(`Nada nuevo: las ${dup} filas ya estaban cargadas.`);
      } else {
        toast.success(
          `Cargadas ${ins} filas nuevas${dup > 0 ? ` · ${dup} repetidas omitidas` : ""}.`
        );
      }
      router.push("/auditorias");
      router.refresh();
    } finally {
      setCommitting(false);
    }
  }, [file, preview, periodo, opticaId, router]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPeriodo("");
    setOpticaId("");
  };

  return (
    <div className="space-y-6">
      {!preview && (
        <Card>
          <CardContent className="p-0">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-16 text-center transition-colors ${
                dragging
                  ? "border-primary bg-accent/50"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              {loading ? (
                <Loader2 className="size-10 animate-spin text-primary" />
              ) : (
                <div className="grid size-14 place-items-center rounded-full bg-accent text-primary">
                  <UploadCloud className="size-7" />
                </div>
              )}
              <div>
                <p className="font-medium">
                  {loading
                    ? "Analizando…"
                    : "Arrastra un Excel de Softop aquí"}
                </p>
                <p className="text-sm text-muted-foreground">
                  o haz clic para seleccionar (.xlsx / .xls)
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) analyze(f);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-lg bg-accent text-primary">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">{preview.tipoLabel}</p>
                    <p className="text-sm text-muted-foreground">{file?.name}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={reset}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Filas detectadas" value={preview.totalFilas} />
                <Stat
                  label="Filas con alerta"
                  value={preview.filasConAlerta}
                  alert={preview.filasConAlerta > 0}
                />
                <Stat
                  label="Ópticas en el archivo"
                  value={preview.opticas.length || "—"}
                />
              </div>

              {preview.existentes.length > 0 && (
                <div className="rounded-lg border border-sev-media/40 bg-sev-media/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TriangleAlert className="size-4 text-sev-media" />
                    Estos períodos ya tienen datos. Se{" "}
                    <span className="underline">agregan</span> solo las filas nuevas
                    (las repetidas se omiten):
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {preview.existentes.map((e, i) => (
                      <li key={i}>
                        <Badge variant="secondary">
                          {e.optica} · {formatPeriodo(e.periodo)} · {e.filas} filas
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="periodo">Período</Label>
                  <Input
                    id="periodo"
                    type="month"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                  />
                </div>
                {preview.opticas.length === 0 && (
                  <div className="space-y-2">
                    <Label>Óptica</Label>
                    {preview.opticaDetectada ? (
                      <div className="flex h-9 items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 text-sm">
                        <CheckCircle2 className="size-4 text-success" />
                        <span className="font-medium">
                          {preview.opticaDetectada.nombre}
                        </span>
                        <span className="text-muted-foreground">
                          (ID {preview.opticaDetectada.codigoInterno} en el archivo)
                        </span>
                      </div>
                    ) : (
                      <Select value={opticaId} onValueChange={(v) => setOpticaId(v ?? "")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la óptica" />
                        </SelectTrigger>
                        <SelectContent>
                          {opticas.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              {preview.opticas.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Ópticas:</span>
                  {preview.opticas.map((o) => (
                    <Badge key={o} variant="secondary">
                      {o}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
                <Button onClick={commit} disabled={committing}>
                  {committing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Guardando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" /> Confirmar carga
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <PreviewTable preview={preview} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`font-heading text-2xl tabular-nums-fin ${
          alert ? "text-sev-alta" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewTable({ preview }: { preview: Preview }) {
  const cols = preview.preview[0] ? Object.keys(preview.preview[0].data).slice(0, 7) : [];
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="mb-3 text-sm font-medium">
          Vista previa (primeras {preview.preview.length} filas)
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium capitalize">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((r) => (
                <tr
                  key={r.rowIndex}
                  className={`border-t ${r.alerts.length > 0 ? "bg-sev-alta/5" : ""}`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{r.rowIndex}</td>
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap">
                      {String(r.data[c] ?? "—").slice(0, 30)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {r.alerts.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <TriangleAlert className="size-3.5 text-sev-alta" />
                        {[...new Set(r.alerts.map((a) => a.severidad))].map((s) => (
                          <SeverityBadge key={s} severidad={s} />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
