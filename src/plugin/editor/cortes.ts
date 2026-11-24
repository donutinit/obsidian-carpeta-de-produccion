import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { construir, iniciosDePagina, numerosDeParlamento } from '../../motor';
import { preferencias } from '../ajustes';
import { contextoDe } from './contexto';
import { esDocGuion } from './doc';

interface Marcas {
  cortes: { pagina: number; linea: number }[];
  numeros: { linea: number; numero: string }[];
  parlamentos: { linea: number; numero: number }[];
}

const fijarMarcas = StateEffect.define<Marcas>();

/** «── 2 ──»: dónde empieza cada página según el mismo motor que la vista previa. No entra al texto. */
class Corte extends WidgetType {
  constructor(private pagina: number) {
    super();
  }
  eq(o: Corte) {
    return o.pagina === this.pagina;
  }
  toDOM() {
    const d = createDiv();
    d.className = 'cp-ed-corte';
    d.setAttribute('aria-label', `Página ${this.pagina}`);
    d.createSpan({ text: String(this.pagina) });
    return d;
  }
  ignoreEvent() {
    return true;
  }
}

function decoraciones(state: EditorState, m: Marcas): DecorationSet {
  const doc = state.doc;
  const out: Range<Decoration>[] = [];
  for (const c of m.cortes) {
    if (c.linea + 1 > doc.lines) continue;
    out.push(Decoration.widget({ widget: new Corte(c.pagina), block: true, side: -1 }).range(doc.line(c.linea + 1).from));
  }
  for (const n of m.numeros) {
    if (n.linea + 1 > doc.lines) continue;
    out.push(Decoration.line({ class: 'cp-ed-num', attributes: { 'data-cp-num': n.numero } }).range(doc.line(n.linea + 1).from));
  }
  for (const n of m.parlamentos) {
    if (n.linea + 1 > doc.lines) continue;
    out.push(Decoration.line({ class: 'cp-ed-parl', attributes: { 'data-cp-parl': String(n.numero) } }).range(doc.line(n.linea + 1).from));
  }
  return Decoration.set(out, true);
}

const campoMarcas = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let d = deco.map(tr.changes);
    for (const e of tr.effects) if (e.is(fijarMarcas)) d = decoraciones(tr.state, e.value);
    return d;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const vivos = new Set<{ programar(ms: number): void }>();
preferencias.alCambiar.push(() => vivos.forEach((v) => v.programar(0)));

const ESPERA_MS = 400;

const calculador = ViewPlugin.fromClass(
  class {
    private reloj: number | null = null;
    constructor(private view: EditorView) {
      vivos.add(this);
      this.programar(0);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.programar(ESPERA_MS);
    }
    programar(ms: number) {
      if (this.reloj !== null) window.clearTimeout(this.reloj);
      this.reloj = window.setTimeout(() => this.calcular(), ms);
    }
    calcular() {
      this.reloj = null;
      const st = this.view.state;
      const p = preferencias.actual;
      let marcas: Marcas = { cortes: [], numeros: [], parlamentos: [] };
      if (esDocGuion(st.doc) && (p.cortesPagina || p.numerosEscena || p.numerosParlamento)) {
        const g = construir(st.doc.toString(), contextoDe(st).cfg);
        marcas = {
          cortes: p.cortesPagina ? iniciosDePagina(g.paginas) : [],
          numeros: p.numerosEscena ? g.doc.escenas.map((e) => ({ linea: e.linea, numero: e.numero })) : [],
          parlamentos: p.numerosParlamento ? numerosDeParlamento(g.doc) : [],
        };
      }
      this.view.dispatch({ effects: fijarMarcas.of(marcas) });
    }
    destroy() {
      if (this.reloj !== null) window.clearTimeout(this.reloj);
      vivos.delete(this);
    }
  },
);

/** Marcas de corte de página, números de escena y números de parlamento en el editor. */
export const marcasDePagina = [campoMarcas, calculador];
