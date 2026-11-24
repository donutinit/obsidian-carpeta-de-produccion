import { CATEGORIAS, type Categoria } from './categorias';
import { DICCIONARIOS_MX, type Diccionarios } from './diccionarios';

export type Cronometraje = 'pagina' | 'caracteres' | 'tipo';

/** Lo que cambia los resultados de la paginación y los octavos. Vive en el proyecto. */
export interface Config {
  renglonesPorPagina: number;
  espacioAntesEncabezado: number;
  textoMas: string;
  textoContinua: string;
  conservarExtension: boolean;
  ultimaPaginaCompleta: boolean;
  diccionarios: Diccionarios;
  cronometraje: Cronometraje;
  /** Las de fábrica más las extra del proyecto. */
  categorias: Categoria[];
  /** Personajes conocidos aunque no hablen (notas de `Personajes/`): cuentan si se mencionan en la acción. */
  personajesConocidos: string[];
  /** Lo que se presenta con edad pero no es personaje («Tele (32)»): propiedad `no_son_personajes` del proyecto. */
  noSonPersonajes: string[];
}

export const CONFIG_POR_DEFECTO: Config = {
  renglonesPorPagina: 54,
  espacioAntesEncabezado: 1,
  textoMas: '(MORE)',
  textoContinua: "(CONT'D)",
  conservarExtension: true,
  ultimaPaginaCompleta: false,
  diccionarios: DICCIONARIOS_MX,
  cronometraje: 'pagina',
  categorias: CATEGORIAS,
  personajesConocidos: [],
  noSonPersonajes: [],
};

/** Completa con los valores por defecto. Las páginas tienen al menos 8 renglones (las pruebas usan páginas cortas). */
export function resolverConfig(parcial: Partial<Config> = {}): Config {
  const cfg: Config = { ...CONFIG_POR_DEFECTO };
  for (const [k, v] of Object.entries(parcial)) if (v !== undefined) (cfg as unknown as Record<string, unknown>)[k] = v;
  cfg.renglonesPorPagina = Math.max(8, Math.floor(cfg.renglonesPorPagina));
  cfg.espacioAntesEncabezado = Math.max(0, Math.floor(cfg.espacioAntesEncabezado));
  return cfg;
}
