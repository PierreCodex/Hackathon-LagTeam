import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { type Perfil, type Registro, RegistroSchema } from "@reto18/shared";
import { IdentidadService } from "./identidad.service.js";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "./roles.js";

@Controller("identidad")
export class IdentidadController {
  constructor(@Inject(IdentidadService) private readonly identidad: IdentidadService) {}

  /** `POST /api/v1/identidad/registro` (público): crea la cuenta confirmada y su perfil. */
  @Post("registro")
  @HttpCode(HttpStatus.CREATED)
  registrar(@Body({ schema: RegistroSchema }) datos: Registro): Promise<Perfil> {
    return this.identidad.registrar(datos);
  }

  /** `GET /api/v1/identidad/perfil`: perfil de la cuenta que llama. */
  @Get("perfil")
  @Roles("admin", "organizador", "publico")
  perfil(@UsuarioActual() usuario: UsuarioAutenticado): Perfil {
    return usuario.perfil;
  }
}
