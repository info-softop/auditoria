"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink } from "lucide-react";

export function VerFotoButton({
  fileUrl,
  noComprobante,
}: {
  fileUrl: string;
  noComprobante: string;
}) {
  const [open, setOpen] = useState(false);
  const esPdf = fileUrl.toLowerCase().endsWith(".pdf");

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Eye className="size-4" />
        Ver foto
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante del traslado {noComprobante}</DialogTitle>
            <DialogDescription>
              Soporte de la consignación verificada.
            </DialogDescription>
          </DialogHeader>
          {esPdf ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground">
                El comprobante es un documento PDF.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Abrir documento
                </a>
              </Button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={`Comprobante del traslado ${noComprobante}`}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
