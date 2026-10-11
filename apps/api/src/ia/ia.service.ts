import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EntradaTextosYCampana, TextosYCampana } from "@reto18/shared";
import { AdaptadorOllama } from "./adaptador-ollama.js";
import { type ResultadoIa, textosYCampana } from "./funciones/textos-y-campana.js";

/**
 * Servicio del módulo `ia` (AD-11): única puerta al proveedor de IA. Cada función tiene entrada y
 * salida zod, tiempo límite y respaldo, y nunca lanza por un fallo del proveedor.
 */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(@Inject(AdaptadorOllama) private readonly ollama: AdaptadorOllama) {}

  /** Textos, paleta y campaña de la pieza de un evento (`origen: "ia" | "respaldo"`). */
  textosYCampana(entrada: EntradaTextosYCampana): Promise<ResultadoIa<TextosYCampana>> {
    return textosYCampana(
      entrada,
      (peticion) => this.ollama.chat(peticion),
      (mensaje) => this.logger.warn(mensaje),
    );
  }
}
