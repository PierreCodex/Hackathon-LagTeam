import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CODIGOS_IDENTIDAD, type Perfil, type Rol } from "@reto18/shared";
import type { Request } from "express";
import { IdentidadService } from "./identidad.service.js";
import { VerificadorToken } from "./verificador-token.js";

export const ROLES_KEY = "identidad:roles";

/** Cuenta autenticada de la petición. El rol sale siempre de `identidad_perfiles`. */
export interface UsuarioAutenticado {
  id: string;
  correo: string;
  perfil: Perfil;
}

type PeticionConUsuario = Request & { usuario?: UsuarioAutenticado };

/**
 * Protege la ruta: exige un JWT de Supabase válido, un perfil y uno de los roles.
 * Las rutas sin `@Roles()` son públicas.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el `UsuarioAutenticado` (solo en rutas con `@Roles()`). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioAutenticado | undefined =>
    ctx.switchToHttp().getRequest<PeticionConUsuario>().usuario,
);

/** Guard global (AD-3): sin metadatos pasa; con `@Roles()` comprueba token, perfil y rol. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(VerificadorToken) private readonly verificador: VerificadorToken,
    @Inject(IdentidadService) private readonly identidad: IdentidadService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles) return true;

    const peticion = ctx.switchToHttp().getRequest<PeticionConUsuario>();
    const token = /^Bearer\s+(\S+)\s*$/i.exec(peticion.headers.authorization ?? "")?.[1];
    if (!token) {
      throw noAutenticado("Falta el token de sesión (Authorization: Bearer …)");
    }

    const resultado = await this.verificador.verificar(token);
    if (resultado.estado === "no_disponible") {
      throw new ServiceUnavailableException({
        codigo: CODIGOS_IDENTIDAD.AUTH_NO_DISPONIBLE,
        mensaje: "No se pudo validar la sesión. Inténtalo en unos segundos.",
      });
    }
    if (resultado.estado === "invalido") {
      throw noAutenticado("La sesión no es válida o ha caducado. Inicia sesión de nuevo.");
    }

    const { id, correo } = resultado.identidad;
    const perfil = await this.identidad.perfilDe(id, correo);
    if (!perfil) {
      throw new ForbiddenException({
        codigo: CODIGOS_IDENTIDAD.SIN_PERFIL,
        mensaje: "Tu cuenta no tiene perfil. Contacta con el administrador.",
      });
    }
    if (roles.length > 0 && !roles.includes(perfil.rol)) {
      throw new ForbiddenException({
        codigo: CODIGOS_IDENTIDAD.SIN_PERMISO,
        mensaje: "Tu rol no tiene permiso para esta acción",
      });
    }

    peticion.usuario = { id, correo, perfil };
    return true;
  }
}

function noAutenticado(mensaje: string): UnauthorizedException {
  return new UnauthorizedException({ codigo: CODIGOS_IDENTIDAD.NO_AUTENTICADO, mensaje });
}
