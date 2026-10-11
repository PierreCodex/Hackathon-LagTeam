/** Une clases de Tailwind ignorando las vacías: `clases("a", cond && "b")`. */
export function clases(...lista: Array<string | false | null | undefined>): string {
  return lista.filter(Boolean).join(" ");
}
