import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CODIGOS_EVENTOS,
  TAMANO_MAXIMO_ARCHIVO_EVENTO,
  TIPOS_CONSTANCIA_EVENTO,
  TIPOS_FOTO_EVENTO,
} from "@reto18/shared";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

/** Tiempo límite de cada llamada a Storage (subir o borrar). */
export const TIEMPO_LIMITE_STORAGE_MS = 10_000;

export const BUCKET_FOTOS = "eventos-fotos";
export const BUCKET_CONSTANCIAS = "eventos-constancias";
export const DURACION_FIRMA_CONSTANCIA_SEGUNDOS = 300;

/** Lo que usa el módulo de un archivo de multer (memoria). */
export interface ArchivoEntrada {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
}

/** Archivo ya subido: lo necesario para guardarlo en el evento o borrarlo. */
export interface ArchivoSubido {
  bucket: string;
  ruta: string;
  url: string;
}

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Tipo real del archivo por sus primeros bytes. No se confía en el `Content-Type` que manda el
 * navegador: un archivo renombrado no pasa.
 */
export function detectarTipo(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export type CampoArchivo = "foto" | "constancia";

/** Valida tamaño y tipo. Devuelve el tipo detectado, que es el que se guarda en Storage. */
export function validarArchivo(archivo: ArchivoEntrada, campo: CampoArchivo): string {
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO_EVENTO || archivo.buffer.length > TAMANO_MAXIMO_ARCHIVO_EVENTO) {
    throw archivoNoValido(`${campo}: el archivo pasa de 5 MB`);
  }
  const permitidos: readonly string[] = campo === "foto" ? TIPOS_FOTO_EVENTO : TIPOS_CONSTANCIA_EVENTO;
  const tipo = detectarTipo(archivo.buffer);
  if (!tipo || !permitidos.includes(tipo)) {
    throw archivoNoValido(
      campo === "foto"
        ? "foto: debe ser una imagen JPG, PNG o WebP"
        : "constancia: debe ser un PDF o una imagen JPG, PNG o WebP",
    );
  }
  return tipo;
}

export function archivoNoValido(mensaje: string): BadRequestException {
  return new BadRequestException({ codigo: CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, mensaje });
}

function storageNoDisponible(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    codigo: CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE,
    mensaje: "No se pudo acceder al almacenamiento de archivos. Inténtalo en unos minutos.",
  });
}

class TiempoLimiteAgotado extends Error {}

/** Storage de los eventos (foto pública y constancia privada). Aísla a Supabase para las pruebas. */
@Injectable()
export class ArchivosEventos {
  private readonly logger = new Logger(ArchivosEventos.name);

  constructor(@Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase) {}

  /** Sube la foto y devuelve su URL pública. */
  subirFoto(organizadorId: string, archivo: ArchivoEntrada, tipo: string): Promise<ArchivoSubido> {
    return this.subir(BUCKET_FOTOS, organizadorId, archivo, tipo);
  }

  /**
   * Sube la constancia y devuelve la URL del objeto (`…/storage/v1/object/eventos-constancias/<ruta>`).
   * El bucket es privado: la URL no se abre sin firma.
   */
  subirConstancia(organizadorId: string, archivo: ArchivoEntrada, tipo: string): Promise<ArchivoSubido> {
    return this.subir(BUCKET_CONSTANCIAS, organizadorId, archivo, tipo);
  }

  /** Firma únicamente un objeto del bucket privado y del propietario indicado por la BD. */
  async firmarConstancia(organizadorId: string, urlGuardada: string): Promise<string> {
    if (!this.supabase) throw storageNoDisponible();
    const almacen = this.supabase.storage.from(BUCKET_CONSTANCIAS);
    const base = almacen.getPublicUrl("").data.publicUrl.replace("/storage/v1/object/public/", "/storage/v1/object/");
    const prefijo = `${base}${organizadorId}/`;
    const nombre = urlGuardada.startsWith(prefijo) ? urlGuardada.slice(prefijo.length) : "";
    // Rutas canónicas generadas en subir(): UUID/extensión. No admite firmas, traversal ni otro origen.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/i.test(nombre)) {
      throw archivoNoValido("La ruta de la constancia no pertenece al archivo privado del organizador");
    }
    try {
      const { data, error } = await conTiempoLimite(
        almacen.createSignedUrl(`${organizadorId}/${nombre}`, DURACION_FIRMA_CONSTANCIA_SEGUNDOS),
      );
      if (error || !data?.signedUrl) throw error ?? new Error("Firma vacía");
      return data.signedUrl;
    } catch {
      throw storageNoDisponible();
    }
  }

  /** Borra lo subido. Nunca lanza: si falla, deja el aviso en el log con las rutas. */
  async borrar(archivos: ArchivoSubido[]): Promise<void> {
    const supabase = this.supabase;
    if (!supabase || archivos.length === 0) return;
    const porBucket = new Map<string, string[]>();
    for (const { bucket, ruta } of archivos) porBucket.set(bucket, [...(porBucket.get(bucket) ?? []), ruta]);
    await Promise.all(
      [...porBucket].map(async ([bucket, rutas]) => {
        try {
          const { error } = await conTiempoLimite(supabase.storage.from(bucket).remove(rutas));
          if (error) throw error;
        } catch (e) {
          this.logger.error(`No se pudieron borrar ${bucket}/${rutas.join(", ")}: ${mensajeDe(e)}`);
        }
      }),
    );
  }

  private async subir(
    bucket: string,
    organizadorId: string,
    archivo: ArchivoEntrada,
    tipo: string,
  ): Promise<ArchivoSubido> {
    const supabase = this.supabase;
    if (!supabase) {
      this.logger.warn("Supabase no está configurado: no se pueden subir archivos");
      throw storageNoDisponible();
    }
    const ruta = `${organizadorId}/${randomUUID()}.${EXTENSIONES[tipo] ?? "bin"}`;
    const almacen = supabase.storage.from(bucket);
    const subida = almacen.upload(ruta, archivo.buffer, { contentType: tipo, upsert: false });

    try {
      const { error } = await conTiempoLimite(subida);
      if (error) throw error;
    } catch (e) {
      if (e instanceof TiempoLimiteAgotado) {
        this.logger.warn(`Storage no respondió en ${TIEMPO_LIMITE_STORAGE_MS} ms al subir ${bucket}/${ruta}`);
        // Si la subida termina después, se borra para no dejar un archivo huérfano.
        void subida.then(
          ({ error }) => (error ? undefined : this.borrar([{ bucket, ruta, url: "" }])),
          () => undefined,
        );
      } else {
        this.logger.warn(`No se pudo subir ${bucket}/${ruta}: ${mensajeDe(e)}`);
      }
      throw storageNoDisponible();
    }

    const publica = almacen.getPublicUrl(ruta).data.publicUrl;
    const url = bucket === BUCKET_FOTOS ? publica : publica.replace("/storage/v1/object/public/", "/storage/v1/object/");
    return { bucket, ruta, url };
  }
}

async function conTiempoLimite<T>(promesa: Promise<T>): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new TiempoLimiteAgotado()), TIEMPO_LIMITE_STORAGE_MS);
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : String(e);
}
