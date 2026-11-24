import { resolverConfig, type Config } from './config';
import { armarBreakdown, type BreakdownEscena } from './breakdown';
import { analizar } from './fountain';
import { maquetar } from './maquetar';
import { calcularOctavos } from './octavos';
import { paginar } from './paginar';
import type { Bloque, Documento, Octavos, Pagina } from './tipos';

export * from './tipos';
export * from './categorias';
export * from './config';
export * from './diccionarios';
export * from './propiedades';
export { analizarEnLinea, MARCA, textoPlano } from './enlinea';
export { analizar, clasificarLineas, MOMENTOS_MX, PREFIJO_ESCENA, TRANSICIONES_MX, type OpcionesAnalisis } from './fountain';
export { COLUMNAS, COLUMNAS_DUAL } from './maquetar';
export { iniciosDePagina } from './paginar';
export { formatearOctavos, segundosAproximados } from './octavos';
export { contarPalabras, duracionEscenas, duracionTotal, formatearDuracion } from './duracion';
export { alternarDual, escenaEnLinea, moverEscena, type Cambio } from './escenas';
export { bloquearNumeracion, desbloquearNumeracion, numerarEscenas } from './numeracion';
export * from './teclado';
export * from './listas';
export * from './csv';
export * from './ediciones';
export * from './fountain-io';
export * from './fdx';
export * from './comentarios';
export * from './buscar';
export * from './sides';
export * from './requisitos';
export * from './correcciones';
export * from './sugerencias';
export * from './fechas';
export * from './tablas';
export * from './selectores';
export * from './timing';
export * from './revisor';
export * from './plan';
export * from './personajes';

export type { BreakdownEscena } from './breakdown';
export { nombrePropio } from './breakdown';
export { aplicarMarca, type ResultadoMarca } from './marcas';

export interface Guion {
  doc: Documento;
  bloques: Bloque[];
  paginas: Pagina[];
  octavos: Octavos;
  breakdown: BreakdownEscena[];
  config: Config;
}

/** analizar → maquetar → paginar → octavos. */
export function construir(fuente: string, parcial?: Partial<Config>): Guion {
  const config = resolverConfig(parcial);
  const doc = analizar(fuente, { transiciones: config.diccionarios.transiciones, momentos: config.diccionarios.momentos });
  const bloques = maquetar(doc, config);
  const paginas = paginar(bloques, config);
  const octavos = calcularOctavos(paginas, doc.escenas.length, config);
  return { doc, bloques, paginas, octavos, breakdown: armarBreakdown(doc, bloques, { conocidos: config.personajesConocidos }), config };
}
