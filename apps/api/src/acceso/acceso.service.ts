import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CODIGOS_ACCESO, type ResultadoValidacion } from "@reto18/shared";
import type { UsuarioAutenticado } from "../identidad/roles.js";
import { FirmaQr } from "../ventas/qr.js";
import { VentasService } from "../ventas/ventas.service.js";

/** Servicio del módulo `acceso`: validación en la puerta (AD-7). Llega a las entradas solo por `VentasService`. */
@Injectable()
export class AccesoService {
  constructor(
    @Inject(VentasService) private readonly ventas: VentasService,
    @Inject(FirmaQr) private readonly qr: FirmaQr,
  ) {}

  /**
   * Valida el QR en la puerta del evento: lo valida el organizador dueño del evento o un admin
   * (un organizador ajeno recibe 404, como si no existiera). La entrada se usa una sola vez.
   */
  async validar(usuario: UsuarioAutenticado, eventoId: string, qr: string): Promise<ResultadoValidacion> {
    const organizador = await this.ventas.organizadorDelEvento(eventoId);
    if (!organizador || (usuario.perfil.rol !== "admin" && organizador !== usuario.id)) {
      throw new NotFoundException({ codigo: CODIGOS_ACCESO.EVENTO_NO_ENCONTRADO, mensaje: "El evento no existe" });
    }
    const entradaId = this.qr.verificar(qr);
    if (!entradaId) throw qrInvalido();

    const consumo = await this.ventas.consumirEntrada(entradaId, eventoId);
    switch (consumo.estado) {
      case "aceptada":
        return { resultado: "aceptada", entrada_id: entradaId, evento_id: eventoId, usada_en: consumo.usada_en };
      case "ya_usada":
        throw new ConflictException({
          codigo: CODIGOS_ACCESO.ENTRADA_YA_USADA,
          mensaje: "Esta entrada ya se usó",
          detalles: { usada_en: consumo.usada_en },
        });
      case "otro_evento":
        throw new ConflictException({ codigo: CODIGOS_ACCESO.ENTRADA_DE_OTRO_EVENTO, mensaje: "La entrada es de otro evento" });
      case "no_existe":
        throw qrInvalido();
    }
  }
}

function qrInvalido(): BadRequestException {
  return new BadRequestException({ codigo: CODIGOS_ACCESO.QR_INVALIDO, mensaje: "El QR no es una entrada válida" });
}
