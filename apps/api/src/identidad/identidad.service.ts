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
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

export const TABLA_PERFILES = "identidad_perfiles";
export const COLUMNAS_PERFIL = "id, rol, whatsapp, ciudad, acepta_avisos";

/** Tiempo límite de la lectura del perfil (se hace en cada petición protegida). */
export const TIEMPO_LIMITE_PERFIL_MS = 3000;

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
   * Si el perfil falla, borra la cuenta para no dejar cuentas sin rol.
   */
  async registrar(datos: Registro): Promise<Perfil> {
    const supabase = this.cliente();

    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.correo,
      password: datos.contrasena,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw this.errorDeCreacion(error);
    }
    const usuario = data.user;

    const fila: FilaPerfil = {
      id: usuario.id,
      rol: datos.rol,
      whatsapp: datos.whatsapp,
      ciudad: datos.ciudad ?? null,
      acepta_avisos: datos.acepta_avisos,
    };
    const insercion = await supabase
      .from(TABLA_PERFILES)
      .insert(fila)
      .select(COLUMNAS_PERFIL)
      .single();
    if (insercion.error || !insercion.data) {
      this.logger.error(
        `No se pudo crear el perfil de ${usuario.id}: ${insercion.error?.message ?? "sin datos"}`,
      );
      const borrado = await supabase.auth.admin.deleteUser(usuario.id);
      if (borrado.error) {
        this.logger.error(
          `No se pudo borrar la cuenta huérfana ${usuario.id}: ${borrado.error.message}`,
        );
      }
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
      correoFinal = usuario.data.user?.email ?? "";
    }
    return aPerfil(data as FilaPerfil, correoFinal);
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

  private errorDeCreacion(error: AuthError | null): Error {
    const codigo = error?.code;
    if (codigo === "email_exists" || codigo === "user_already_exists") {
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
    if (!error || isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) {
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
