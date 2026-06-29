"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full h-11 text-base" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Ingresando…
        </>
      ) : (
        "Ingresar"
      )}
    </Button>
  );
}

export default function LoginPage() {
  const [errorMessage, formAction] = useActionState(authenticate, undefined);
  const [showPwd, setShowPwd] = useState(false);

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-2 overflow-hidden">
      {/* Panel de marca */}
      <section className="relative hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, color-mix(in oklch, white 22%, transparent) 0, transparent 38%), radial-gradient(circle at 80% 70%, color-mix(in oklch, white 14%, transparent) 0, transparent 42%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
            <BrandLogo variant="isotype" height={32} priority />
          </div>
          <span className="font-heading text-xl tracking-tight">Auditoría</span>
        </div>
        <div className="relative space-y-5">
          <div className="h-px w-16 bg-primary-foreground/40" />
          <h1 className="font-heading text-5xl leading-[1.05] tracking-tight">
            Claridad total
            <br />
            sobre tus ópticas.
          </h1>
          <p className="max-w-sm text-primary-foreground/80 leading-relaxed">
            Carga los reportes de Softop, detecta anomalías al instante, concilia
            bancos y mide el rendimiento — en un solo lugar.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/60">
          Plataforma interna · {new Date().getFullYear()}
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <BrandLogo variant="horizontal" height={28} priority />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-3xl tracking-tight">Bienvenido</h2>
            <p className="text-muted-foreground">
              Ingresa con tu cuenta para continuar.
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@softop.la"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Mostrar contraseña"
                >
                  <Eye className="size-4" />
                </button>
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            )}

            <SubmitButton />
          </form>
        </div>
      </section>
    </main>
  );
}
