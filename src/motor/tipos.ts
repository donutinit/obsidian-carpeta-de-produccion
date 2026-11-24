/** Un tramo de texto con el mismo formato dentro de una línea. */
export interface Segmento {
  t: string;
  /** Código de categoría del breakdown, si el tramo está marcado. */
  cat?: string;
  /** Nombre del elemento en el breakdown. */
  item?: string;
  cantidad?: number;
  b?: true;
  i?: true;
  u?: true;
}

export type TipoElemento =
  | 'encabezado'
  | 'accion'
  | 'plano'
  | 'personaje'
  | 'acotacion'
  | 'dialogo'
  | 'letra'
  | 'transicion'
  | 'centrado'
  | 'salto'
  | 'seccion'
  | 'sinopsis';

export interface Elemento {
  tipo: TipoElemento;
  /** En `accion`, las líneas del párrafo van separadas por «\n». */
  texto: string;
  /** Línea del texto fuente, desde 0. */
  linea: number;
  /** Índice de la escena, o -1 antes del primer encabezado. */
  escena: number;
  /** En `accion`: la línea fuente de cada línea del párrafo (un comentario intermedio las separa). */
  lineasFuente?: number[];
  /** En `personaje`: el nombre sin extensión. */
  nombre?: string;
  /** En `personaje`: la extensión sin paréntesis, p. ej. «V.O.» o «CONT'D». */
  extension?: string;
  dual?: boolean;
}

export interface Escena {
  indice: number;
  numero: string;
  numeroFijo?: string;
  /** El encabezado en mayúsculas, sin el número fijo. */
  encabezado: string;
  introduccion: string;
  locacion: string;
  momento: string;
  linea: number;
  meta: Record<string, string>;
  /** Identificador estable (`%%escena: id=…%%`). */
  id?: string;
  /** Línea del comentario `%%escena: …%%`, si hay. */
  lineaMeta?: number;
}

/** Una marca dentro de un comentario `%%…%%`: cuenta en el breakdown y no se imprime. */
export interface MarcaOculta {
  linea: number;
  escena: number;
  cat: string;
  item: string;
  cantidad: number;
}

export interface Documento {
  portada: Record<string, string[]>;
  elementos: Elemento[];
  escenas: Escena[];
  ocultas: MarcaOculta[];
}

export type TipoLinea =
  | 'encabezado'
  | 'accion'
  | 'plano'
  | 'personaje'
  | 'acotacion'
  | 'dialogo'
  | 'letra'
  | 'transicion'
  | 'centrado'
  | 'blanco'
  | 'mas'
  | 'continua';

/** Un renglón de la rejilla de 60 columnas. */
export interface Linea {
  tipo: TipoLinea;
  columna: number;
  segs: Segmento[];
  escena: number;
  /** Línea del texto fuente de la que sale. */
  fuente?: number;
  primeraDeEscena?: boolean;
  /** En un diálogo dual: la columna derecha del mismo renglón. */
  der?: { tipo: TipoLinea; columna: number; segs: Segmento[]; fuente?: number; hablante?: string };
  /** En un bloque de diálogo: quién habla (para resaltar los sides de un actor). */
  hablante?: string;
}

/** Un párrafo maquetado. Un bloque de diálogo agrupa personaje, acotaciones, diálogos y letras. */
export interface Bloque {
  tipo: 'encabezado' | 'accion' | 'plano' | 'dialogo' | 'dual' | 'transicion' | 'centrado' | 'salto';
  escena: number;
  lineas: Linea[];
  espacioAntes: number;
  personaje?: { nombre: string; extension?: string };
  /** En un diálogo dual: quien habla en la columna derecha. */
  personajeDer?: { nombre: string; extension?: string };
}

export interface Pagina {
  lineas: Linea[];
}

/** La parte de una escena dentro de una página, en renglones [inicio, fin). */
export interface Tramo {
  escena: number;
  inicio: number;
  fin: number;
  octavos: number;
}

export interface Octavos {
  porPagina: Tramo[][];
  porEscena: number[];
  /** Números de página (desde 1) en que aparece cada escena. */
  paginasPorEscena: number[][];
  total: number;
}
