import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Abstracción de almacenamiento de archivos (fotos de consignación/traslado).
 * - Local (dev): guarda en /public/uploads y devuelve una ruta relativa.
 * - Producción (Cloud Run): si está definida GCS_BUCKET, sube a Google Cloud
 *   Storage y devuelve la URL pública. El disco de Cloud Run es efímero, por eso
 *   en producción SÍ o SÍ debe usarse GCS (u otro storage externo).
 */
export interface StorageProvider {
  save(file: Buffer, fileName: string, contentType: string): Promise<string>;
}

function safeName(fileName: string): string {
  return `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

class LocalStorageProvider implements StorageProvider {
  private dir = path.join(process.cwd(), "public", "uploads");

  async save(file: Buffer, fileName: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const safe = safeName(fileName);
    await writeFile(path.join(this.dir, safe), file);
    return `/uploads/${safe}`;
  }
}

class GcsStorageProvider implements StorageProvider {
  constructor(private bucket: string) {}

  async save(file: Buffer, fileName: string, contentType: string): Promise<string> {
    // Import dinámico: el SDK solo se carga cuando GCS está configurado.
    const { Storage } = await import("@google-cloud/storage");
    // En Cloud Run usa las credenciales de la cuenta de servicio (ADC); no se
    // necesita archivo de llave.
    const storage = new Storage();
    const safe = safeName(fileName);
    await storage.bucket(this.bucket).file(`uploads/${safe}`).save(file, {
      contentType: contentType || "application/octet-stream",
      resumable: false,
    });
    // Bucket PRIVADO: la foto se sirve por un endpoint autenticado de la app
    // (src/app/api/uploads/[file]) que lee de GCS solo si hay sesión.
    return `/api/uploads/${safe}`;
  }
}

export const storage: StorageProvider = process.env.GCS_BUCKET
  ? new GcsStorageProvider(process.env.GCS_BUCKET)
  : new LocalStorageProvider();
