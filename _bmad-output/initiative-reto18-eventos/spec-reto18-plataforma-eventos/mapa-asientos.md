# Mapa de asientos (CAP-15 y CAP-16)

Croquis reales recibidos el 10/10/2026, capturas de un mapa digital:
- `../insumos/WhatsApp Image 2026-10-10 at 3.57.46 PM (1).jpeg`: Platea baja y Platea media.
- `../insumos/WhatsApp Image 2026-10-10 at 3.57.46 PM.jpeg`: Mezanine, 2.º piso.

Son un ejemplo ilustrativo de un local que podría subir un organizador, no un local concreto. Sirven como caso de prueba de la IA y como sede ficticia de la demo.

## Estructura que tiene que representar el mapa

Sede → secciones → filas → bloques → asientos. Cada asiento tiene una categoría de precio y un estado.

| Rasgo observado | Ejemplo en los croquis | Qué exige |
|---|---|---|
| Varias secciones por sede | Platea baja (A–H), Platea media (I–O), Mezanine (P–W) | Secciones con nombre y orden respecto al escenario |
| Filas de distinta longitud | A tiene 22 asientos, D 24, G 26; I 28, L 30; R 37, U 22 | El número de asientos se define por fila, no por sección |
| Pasillos que separan bloques | 2 bloques en las plateas y 3 en el mezanine | Cada fila se divide en bloques con su rango de asientos |
| Numeración continua a través del pasillo | Fila A: 1–11 y 12–22 | El número del asiento es único dentro de la fila |
| Filas desplazadas o más cortas | Mezanine U–W, con huecos al principio de los bloques | Cada bloque tiene una posición o desplazamiento propio |
| Precio por asiento, no por sección | En la Platea baja hay varios colores en una misma fila | Las categorías de precio se asignan por rangos de asientos |
| Estado del asiento | Gris: vendido. Los colores son categorías de precio (confirmado) | Cada asiento puede estar disponible, bloqueado durante un pago o vendido |

Capacidad aproximada que se lee en los croquis: Platea baja 190, Platea media 204 y Mezanine 249, unas 640 butacas.

## Flujo del organizador

1. Sube el croquis (CAP-16, opcional).
2. La IA llena la pizarra con las secciones, filas y bloques que reconoce (CAP-16). Sin la IA, la pizarra empieza vacía (CAP-15).
3. El organizador corrige sobre la pizarra:
   - Toca un asiento para quitarlo.
   - Pulsa "+" al final de una fila para añadir asientos.
   - Añade o quita filas completas.
   - Selecciona un rango de asientos y le asigna una categoría de precio, que se pinta de su color.
4. Guarda. El público elige butaca sobre ese mismo mapa. Nada de lo que propone la IA se publica sin este paso.

## Fuera de alcance

Un editor libre: arrastrar asientos, dibujar formas o curvas. La pizarra se limita a secciones, filas y bloques.

## Respaldo

Si la IA falla con un croquis, el organizador arma el mapa desde la pizarra vacía.
