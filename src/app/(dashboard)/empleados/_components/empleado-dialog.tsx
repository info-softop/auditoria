"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import { upsertEmpleado } from "../actions";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export interface EmpleadoValores {
  id?: string;
  codigo: string;
  tipoEmpleado: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  tipoContrato: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  cargoNombre: string;
  opticaId: string;
  telefono: string;
  correo: string;
  fechaAdmision: string;
  municipalidad: string;
  direccion: string;
  metodoPago: string;
  bancoNombre: string;
  tipoCuenta: string;
  numeroCuenta: string;
  salario: string;
  subsidioTransporte: boolean;
  subsidioTransporteValor: string;
  pensionAltoRiesgo: boolean;
  salarioIntegral: boolean;
  estado: string;
  fechaRetiro: string;
  motivoRetiro: string;
  notas: string;
}

function Seccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-2 mt-2 border-b pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function EmpleadoDialog({
  opticas,
  cargos,
  valores,
  modo,
}: {
  opticas: { id: string; nombre: string }[];
  cargos: string[];
  valores?: EmpleadoValores;
  modo: "nuevo" | "editar";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const v = valores;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertEmpleado(formData);
      if (res.ok) {
        toast.success("Empleado guardado");
        setOpen(false);
      } else {
        toast.error(res.error ?? "No se pudo guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          modo === "nuevo" ? (
            <Button>
              <Plus className="size-4" /> Nuevo empleado
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" /> Editar
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{modo === "nuevo" ? "Nuevo empleado" : "Editar empleado"}</DialogTitle>
        </DialogHeader>

        <form action={onSubmit} className="grid grid-cols-2 gap-3">
          {v?.id && <input type="hidden" name="id" value={v.id} />}

          <Seccion>Vinculación</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="tipoEmpleado">Tipo de empleado</Label>
            <select id="tipoEmpleado" name="tipoEmpleado" defaultValue={v?.tipoEmpleado ?? "dependiente"} className={cn(SELECT_CLASS)}>
              <option value="dependiente">Dependiente (nómina)</option>
              <option value="independiente">Independiente (prestación)</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tipoContrato">Tipo de contrato</Label>
            <select id="tipoContrato" name="tipoContrato" defaultValue={v?.tipoContrato ?? "indefinido"} className={cn(SELECT_CLASS)}>
              <option value="indefinido">Término indefinido</option>
              <option value="fijo">Término fijo</option>
              <option value="obra_labor">Obra o labor</option>
              <option value="prestacion_servicios">Prestación de servicios</option>
              <option value="aprendizaje">Aprendizaje</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cargoNombre">Cargo</Label>
            <Input id="cargoNombre" name="cargoNombre" list="cargos-list" defaultValue={v?.cargoNombre} placeholder="Asesora, Optómetra…" />
            <datalist id="cargos-list">
              {cargos.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="opticaId">Óptica</Label>
            <select id="opticaId" name="opticaId" defaultValue={v?.opticaId ?? ""} className={cn(SELECT_CLASS)}>
              <option value="">Sin asignar</option>
              {opticas.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>

          <Seccion>Identificación</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" name="codigo" defaultValue={v?.codigo} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tipoIdentificacion">Tipo ID</Label>
              <select id="tipoIdentificacion" name="tipoIdentificacion" defaultValue={v?.tipoIdentificacion ?? "CC"} className={cn(SELECT_CLASS)}>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PA">PA</option>
                <option value="TI">TI</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="numeroIdentificacion">N° ID</Label>
              <Input id="numeroIdentificacion" name="numeroIdentificacion" defaultValue={v?.numeroIdentificacion} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nombre">Nombre(s)</Label>
            <Input id="nombre" name="nombre" required defaultValue={v?.nombre} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="primerApellido">Primer apellido</Label>
              <Input id="primerApellido" name="primerApellido" defaultValue={v?.primerApellido} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="segundoApellido">Segundo apellido</Label>
              <Input id="segundoApellido" name="segundoApellido" defaultValue={v?.segundoApellido} />
            </div>
          </div>

          <Seccion>Contacto</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" name="telefono" defaultValue={v?.telefono} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="correo">Correo</Label>
            <Input id="correo" name="correo" type="email" defaultValue={v?.correo} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaAdmision">Fecha de admisión</Label>
            <Input id="fechaAdmision" name="fechaAdmision" type="date" defaultValue={v?.fechaAdmision} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="municipalidad">Municipio</Label>
            <Input id="municipalidad" name="municipalidad" defaultValue={v?.municipalidad} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" name="direccion" defaultValue={v?.direccion} />
          </div>

          <Seccion>Pago</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="metodoPago">Método de pago</Label>
            <select id="metodoPago" name="metodoPago" defaultValue={v?.metodoPago ?? "transferencia_debito"} className={cn(SELECT_CLASS)}>
              <option value="transferencia_debito">Transferencia débito</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bancoNombre">Banco</Label>
            <Input id="bancoNombre" name="bancoNombre" defaultValue={v?.bancoNombre} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tipoCuenta">Tipo de cuenta</Label>
            <select id="tipoCuenta" name="tipoCuenta" defaultValue={v?.tipoCuenta ?? ""} className={cn(SELECT_CLASS)}>
              <option value="">—</option>
              <option value="ahorro">Ahorro</option>
              <option value="corriente">Corriente</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="numeroCuenta">N° de cuenta</Label>
            <Input id="numeroCuenta" name="numeroCuenta" defaultValue={v?.numeroCuenta} />
          </div>

          <Seccion>Remuneración</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="salario">Salario (COP)</Label>
            <Input id="salario" name="salario" type="number" min={0} step="1000" defaultValue={v?.salario} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subsidioTransporteValor">Valor subsidio transporte</Label>
            <Input id="subsidioTransporteValor" name="subsidioTransporteValor" type="number" min={0} step="1000" defaultValue={v?.subsidioTransporteValor} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="subsidioTransporte" defaultChecked={v?.subsidioTransporte} className="size-4" />
            Recibe subsidio de transporte
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pensionAltoRiesgo" defaultChecked={v?.pensionAltoRiesgo} className="size-4" />
            Pensión alto riesgo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="salarioIntegral" defaultChecked={v?.salarioIntegral} className="size-4" />
            Salario integral
          </label>

          <Seccion>Estado</Seccion>
          <div className="grid gap-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select id="estado" name="estado" defaultValue={v?.estado ?? "activo"} className={cn(SELECT_CLASS)}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaRetiro">Fecha de retiro</Label>
            <Input id="fechaRetiro" name="fechaRetiro" type="date" defaultValue={v?.fechaRetiro} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="motivoRetiro">Motivo de retiro</Label>
            <Input id="motivoRetiro" name="motivoRetiro" defaultValue={v?.motivoRetiro} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Input id="notas" name="notas" defaultValue={v?.notas} />
          </div>

          <DialogFooter className="col-span-2">
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
