import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CODIGOS_IDENTIDAD,
  CODIGO_BD_NO_DISPONIBLE,
  type Perfil,
  type Registro,
  type Rol,
} from "@reto18/shared";
import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";
import { buscarCuentaPorCorreo } from "./cuentas.js";
import { authNoDisponible } from "./verificador-token.js";

export const TABLA_PERFILES = "identidad_perfiles";
export const COLUMNAS_PERFIL = "id, rol, whatsapp, ciudad, acepta_avisos";

/** Tiempo límite de la lectura del perfil (se hace en cada petición protegida). */
export const TIEMPO_LIMITE_PERFIL_MS = 3000;
/** Tiempo límite de las lecturas de varios perfiles (paneles del administrador). */
export const TIEMPO_LIMITE_LISTA_MS = 10_000;

export interface FilaPerfil {
  id: string;
  rol: Rol;
  whatsapp: string;
  ciudad: string | null;
  acepta_avisos: boolean;
}

/** Servicio del módulo `identidad`. Es la única puerta a `identidad_perfiles` (AD-2). */
@Injectable()
export class IdentidadService {
  private readonly logger = new Logger(IdentidadService.name);

  constructor(@Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase) {}

  /**
   * Crea la cuenta de Supabase Auth ya confirmada y su perfil en un solo paso.
   * Si el perfil falla, borra la cuenta para no dejar cuentas sin rol; si aun así quedó una
   * (p. ej. falló el borrado), el siguiente registro con ese correo la repara.
   */
  async registrar(datos: Registro): Promise<Perfil> {
    const supabase = this.cliente();
    const usuario = await this.crearCuenta(supabase, datos);

    const fila: FilaPerfil = {
      id: usuario.id,
      rol: datos.rol,
      whatsapp: datos.whatsapp,
      ciudad: datos.ciudad ?? null,
      acepta_avisos: datos.acepta_avisos,
    };
    let insercion: { data: unknown; error: { message: string } | null };
    try {
      insercion = await supabase
        .from(TABLA_PERFILES)
        .insert(fila)
        .select(COLUMNAS_PERFIL)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_PERFIL_MS))
        .single();
    } catch (e) {
      insercion = { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
    if (insercion.error || !insercion.data) {
      this.logger.error(
        `No se pudo crear el perfil de ${usuario.id}: ${insercion.error?.message ?? "sin datos"}`,
      );
      await this.borrarCuentaSinPerfil(supabase, usuario.id);
      throw new InternalServerErrorException({
        codigo: "ERROR_INTERNO",
        mensaje: "No se pudo crear el perfil. Inténtalo de nuevo.",
      });
    }

    return aPerfil(insercion.data as FilaPerfil, usuario.email ?? datos.correo);
  }

  /**
   * Perfil de una cuenta, o `null` si no tiene fila en `identidad_perfiles`.
   * `correo` lo aporta quien ya lo conoce (p. ej. el JWT validado); si falta, se pide a Auth.
   */
  async perfilDe(id: string, correo?: string): Promise<Perfil | null> {
    const supabase = this.cliente();

    const { data, error } = await supabase
      .from(TABLA_PERFILES)
      .select(COLUMNAS_PERFIL)
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_PERFIL_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el perfil ${id}: ${error.message}`);
      throw new ServiceUnavailableException({
        codigo: CODIGO_BD_NO_DISPONIBLE,
        mensaje: "No se pudo leer el perfil. Inténtalo de nuevo.",
      });
    }
    if (!data) return null;

    let correoFinal = correo;
    if (correoFinal === undefined) {
      const usuario = await supabase.auth.admin.getUserById(id);
      if (usuario.error) {
        this.logger.warn(`No se pudo leer la cuenta ${id}: ${usuario.error.message}`);
        throw new ServiceUnavailableException({
          codigo: CODIGOS_IDENTIDAD.AUTH_NO_DISPONIBLE,
          mensaje: "No se pudo leer la cuenta. Inténtalo de nuevo.",
        });
      }
      if (!usuario.data.user) return null;
      correoFinal = usuario.data.user.email ?? "";
    }
    return aPerfil(data as FilaPerfil, correoFinal);
  }

  /** Ciudad de cada cuenta (perfil del público en el tablero, epic 4). Sin perfil, no aparece. */
  async ciudadesDe(ids: string[]): Promise<Map<string, string | null>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();
    const { data, error } = await this.cliente()
      .from(TABLA_PERFILES)
      .select("id, ciudad")
      .in("id", unicos)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_LISTA_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer las ciudades: ${error.message}`);
      throw new ServiceUnavailableException({ codigo: CODIGO_BD_NO_DISPONIBLE, mensaje: "No se pudieron leer los perfiles." });
    }
    return new Map(((data ?? []) as { id: string; ciudad: string | null }[]).map((f) => [f.id, f.ciudad]));
  }

  /** Correo de cada cuenta (liquidación por organizador, epic 4). Si Auth falla, queda vacío. */
  async correosDe(ids: string[]): Promise<Map<string, string>> {
    const supabase = this.cliente();
    const pares = await Promise.all(
      [...new Set(ids)].map(async (id) => {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (error) this.logger.warn(`No se pudo leer la cuenta ${id}: ${error.message}`);
        return [id, data?.user?.email ?? ""] as const;
      }),
    );
    return new Map(pares);
  }

  private cliente(): NonNullable<ClienteSupabase> {
    if (!this.supabase) {
      throw new ServiceUnavailableException({
        codigo: CODIGOS_IDENTIDAD.AUTH_NO_DISPONIBLE,
        mensaje: "Supabase no está configurado en la API",
      });
    }
    return this.supabase;
  }

  /** `createUser`; si el correo ya existe pero su cuenta quedó sin perfil, la repara y reintenta. */
  private async crearCuenta(supabase: SupabaseClient, datos: Registro): Promise<User> {
    const crear = () =>
      supabase.auth.admin.createUser({
        email: datos.correo,
        password: datos.contrasena,
        email_confirm: true,
      });

    let { data, error } = await crear();
    if (esCorreoRepetido(error) && (await this.repararCuentaSinPerfil(supabase, datos.correo))) {
      ({ data, error } = await crear());
    }
    if (error || !data.user) {
      throw this.errorDeCreacion(error);
    }
    return data.user;
  }

  /**
   * Una cuenta sin perfil solo sale de un registro que falló a medias: no tiene datos ni rol.
   * Se borra para que la persona pueda registrarse de nuevo. Devuelve `true` si la borró.
   */
  private async repararCuentaSinPerfil(supabase: SupabaseClient, correo: string): Promise<boolean> {
    try {
      const cuenta = await buscarCuentaPorCorreo(supabase, correo);
      if (!cuenta) return false;
      const { data, error } = await supabase
        .from(TABLA_PERFILES)
        .select("id")
        .eq("id", cuenta.id)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_PERFIL_MS))
        .maybeSingle();
      if (error || data) return false;
      const borrado = await supabase.auth.admin.deleteUser(cuenta.id);
      if (borrado.error) return false;
      this.logger.warn(`Se borró la cuenta sin perfil ${cuenta.id} para repetir su registro`);
      return true;
    } catch (e) {
      this.logger.warn(`No se pudo revisar la cuenta de ${correo}: ${String(e)}`);
      return false;
    }
  }

  private async borrarCuentaSinPerfil(supabase: SupabaseClient, id: string): Promise<void> {
    try {
      const borrado = await supabase.auth.admin.deleteUser(id);
      if (!borrado.error) return;
      this.logger.error(`No se pudo borrar la cuenta sin perfil ${id}: ${borrado.error.message}`);
    } catch (e) {
      this.logger.error(`No se pudo borrar la cuenta sin perfil ${id}: ${String(e)}`);
    }
    // Queda sin perfil: el siguiente registro con ese correo la repara (`repararCuentaSinPerfil`).
  }

  private errorDeCreacion(error: AuthError | null): Error {
    const codigo = error?.code;
    if (esCorreoRepetido(error)) {
      return new ConflictException({
        codigo: CODIGOS_IDENTIDAD.CORREO_YA_REGISTRADO,
        mensaje: "Ese correo ya tiene una cuenta. Inicia sesión.",
      });
    }
    if (codigo === "weak_password") {
      return new BadRequestException("contrasena: La contraseña es demasiado débil");
    }
    if (codigo === "email_address_invalid") {
      return new BadRequestException("correo: El servicio de cuentas no acepta ese correo");
    }
    if (codigo === "validation_failed") {
      return new BadRequestException("Los datos de la cuenta no son válidos");
    }
    if (!error || authNoDisponible(error) || codigo === "over_request_rate_limit") {
      this.logger.warn(`Auth no disponible al registrar: ${error?.message ?? "sin usuario"}`);
      return new ServiceUnavailableException({
        codigo: CODIGOS_IDENTIDAD.AUTH_NO_DISPONIBLE,
        mensaje: "El servicio de cuentas no responde. Inténtalo en unos minutos.",
      });
    }
    this.logger.error(`Auth rechazó el registro (${error.status} ${codigo}): ${error.message}`);
    return new InternalServerErrorException({
      codigo: "ERROR_INTERNO",
      mensaje: "No se pudo crear la cuenta",
    });
  }
}

function esCorreoRepetido(error: AuthError | null): boolean {
  return error?.code === "email_exists" || error?.code === "user_already_exists";
}

function aPerfil(fila: FilaPerfil, correo: string): Perfil {
  return {
    id: fila.id,
    correo,
    rol: fila.rol,
    whatsapp: fila.whatsapp,
    ciudad: fila.ciudad,
    acepta_avisos: fila.acepta_avisos,
  };
}
