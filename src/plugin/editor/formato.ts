import { RangeSetBuilder, type Text } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { clasificarEditor, COLUMNAS, type TipoParrafo } from '../../motor';
import { diccionariosDe } from './contexto';
import { campoDeseado, deseadoDe } from './teclas';

import { esDocGuion } from './doc';

export { esDocGuion };

/** Línea (desde 0) donde cierra el frontmatter, o -1. */
function finFrontmatter(doc: Text): number {
  if (doc.lines < 2 || doc.line(1).text.trim() !== '---') return -1;
  for (let k = 2; k <= doc.lines; k++) if (doc.line(k).text.trim() === '---') return k - 1;
  return -1;
}

/** Marca las líneas que caen dentro de un comentario `%% … %%` (uno sin cerrar llega al final). */
function lineasDeComentario(texto: string, total: number): boolean[] {
  const out = new Array<boolean>(total).fill(false);
  const re = /%%[\s\S]*?(?:%%|$)/g;
  for (const m of texto.matchAll(re)) {
    const ini = texto.slice(0, m.index).split('\n').length - 1;
    const fin = ini + m[0].split('\n').length - 1;
    for (let k = ini; k <= fin && k < total; k++) out[k] = true;
  }
  return out;
}

const ANCHO = 60;
const pct = (n: number) => `${((n / ANCHO) * 100).toFixed(3)}%`;
/** Sangrías del editor sacadas de la rejilla de 60 columnas. */
const SANGRIA: Record<string, string> = Object.fromEntries(
  (['personaje', 'acotacion', 'dialogo', 'letra'] as const).map((t) => {
    const { columna, ancho } = COLUMNAS[t];
    return [t, `--cp-izq: ${pct(columna)}; --cp-der: ${pct(ANCHO - columna - ancho)};`];
  }),
);

const NOMBRE_VACIO: Record<TipoParrafo, string> = {
  encabezado: 'Encabezado de escena',
  accion: 'Acción',
  personaje: 'Personaje',
  acotacion: 'Acotación',
  dialogo: 'Diálogo',
  letra: 'Letra de canción',
  transicion: 'Transición',
  plano: 'Plano',
};

/** En la línea vacía con tipo deseado, el nombre del tipo en gris (no entra al texto). */
class Fantasma extends WidgetType {
  constructor(private tipo: TipoParrafo) {
    super();
  }
  eq(o: Fantasma) {
    return o.tipo === this.tipo;
  }
  toDOM() {
    const s = createSpan();
    s.className = 'cp-ed-fantasma';
    s.textContent = NOMBRE_VACIO[this.tipo];
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  ignoreEvent() {
    return true;
  }
}

function decorar(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  if (!esDocGuion(doc)) return Decoration.none;
  const texto = doc.toString();
  const deseado = deseadoDe(view.state);
  const tipos = clasificarEditor(texto, deseado, diccionariosDe(view.state));
  const comentario = lineasDeComentario(texto, doc.lines);
  const b = new RangeSetBuilder<Decoration>();
  for (let n = finFrontmatter(doc) + 1; n < doc.lines; n++) {
    const linea = doc.line(n + 1);
    const tipo = tipos[n];
    let cls = 'cp-ed-l';
    let attributes: Record<string, string> | undefined;
    if (comentario[n]) cls += ' cp-ed-com';
    else if (tipo) {
      cls += ' cp-ed-' + tipo;
      if (SANGRIA[tipo]) {
        cls += ' cp-ed-sangria';
        attributes = { style: SANGRIA[tipo] };
      }
    } else if (linea.text.trim()) cls += ' cp-ed-portada';
    b.add(linea.from, linea.from, Decoration.line({ class: cls, attributes }));
    if (tipo === 'encabezado') {
      // El número fijo (#5A#) se ve aparte y tenue.
      const m = linea.text.match(/\s*#[^#\s][^#]*#\s*$/);
      if (m && m.index !== undefined) b.add(linea.from + m.index, linea.to, Decoration.mark({ class: 'cp-ed-numfijo' }));
    }
    if (deseado && deseado.linea === n && !linea.text.trim()) b.add(linea.from, linea.from, Decoration.widget({ widget: new Fantasma(deseado.tipo), side: 1 }));
  }
  return b.finish();
}

/** Presentación por tipo de párrafo mientras se escribe (solo en notas con `carpeta: guion`). */
export const formatoGuion = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorar(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.startState.field(campoDeseado, false) !== u.state.field(campoDeseado, false)) this.decorations = decorar(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
