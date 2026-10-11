import { Inject, Injectable } from "@nestjs/common";
import type { Comision, Tablero } from "@reto18/shared";
import { EventosService } from "../eventos/eventos.service.js";
import { IdentidadService } from "../identidad/identidad.service.js";
import { VentasService } from "../ventas/ventas.service.js";
import { armarTablero } from "./calculos.js";

/** Servicio del módulo `negocio` (epic 4). No tiene tablas: lee los otros módulos por sus servicios (AD-2). */
@Injectable()
export class NegocioService {
  constructor(
    @Inject(VentasService) private readonly ventas: VentasService,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(IdentidadService) private readonly identidad: IdentidadService,
  ) {}

  cambiarComision(comision: Comision): Promise<Comision> {
    return this.ventas.cambiarComision(comision);
  }

  async tablero(): Promise<Tablero> {
    const [comision, ordenes, asistencia] = await Promise.all([
      this.ventas.comisionVigente(),
      this.ventas.ordenesPagadas(),
      this.ventas.asistenciaPorEvento(),
    ]);
    const eventos = await this.eventos.resumenesParaNegocio(ordenes.map((o) => o.evento_id));
    const [ciudades, correos] = await Promise.all([
      this.identidad.ciudadesDe(ordenes.map((o) => o.usuario_id)),
      this.identidad.correosDe(eventos.map((e) => e.organizador_id)),
    ]);
    return armarTablero({ comision, ordenes, eventos, asistencia, ciudades, correos });
  }
}
