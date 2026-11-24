import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { editorLivePreviewField, setIcon } from 'obsidian';
import { CATEGORIAS, quitarDeLineaOculta, type Categoria } from '../../motor';
import { claseCategoria } from '../render/papel';
import { contextoDe } from './contexto';
import { esDocGuion } from './formato';

/** Una línea que solo trae marcas ocultas: `%%{equipo:|Steadicam}%%`, lo que se agrega desde el breakdown. */
const LINEA = /^\s*%%((?:\s*\{[a-z]+:[^{}\n]*\})+)\s*%%\s*$/;
const MARCA = /\{([a-z]+):([^{}|\n]*?)(?:\|([^{}|\n]+))?(?:\|(\d+))?\}/g;

interface Etiqueta {
  cat: string;
  nombre: string;
  cantidad: number;
}

/** Quita la etiqueta `k` de la línea donde está el widget; si era la única, la línea entera con su salto. */
function quitar(view: EditorView, dom: HTMLElement, k: number) {
  const linea = view.state.doc.lineAt(view.posAtDOM(dom));
  const nueva = quitarDeLineaOculta(linea.text, k);
  if (nueva === linea.text) return;
  if (nueva !== null) view.dispatch({ changes: { from: linea.from, to: linea.to, insert: nueva } });
  else if (linea.from > 0) view.dispatch({ changes: { from: linea.from - 1, to: linea.to } });
  else view.dispatch({ changes: { from: 0, to: Math.min(linea.to + 1, view.state.doc.length) } });
}

class Etiquetas extends WidgetType {
  constructor(
    private readonly items: Etiqueta[],
    private readonly cats: Categoria[],
  ) {
    super();
  }
  eq(o: Etiquetas): boolean {
    return JSON.stringify(o.items) === JSON.stringify(this.items);
  }
  toDOM(view: EditorView): HTMLElement {
    const s = view.dom.ownerDocument.createElement('span');
    s.className = 'cp-ed-ocultas';
    this.items.forEach((x, k) => {
      const texto = x.cantidad > 1 ? `${x.nombre} ×${x.cantidad}` : x.nombre;
      const chip = s.createSpan({ cls: 'cp-mark cp-ed-oculta ' + claseCategoria(x.cat, this.cats), text: texto });
      const b = chip.createEl('button', { cls: 'cp-ed-oculta-quitar', attr: { type: 'button', 'aria-label': `Quitar ${texto}` } });
      setIcon(b, 'x');
      // Sin mover el cursor del editor.
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => {
        e.preventDefault();
        quitar(view, s, k);
      });
    });
    return s;
  }
  /** Las etiquetas no se editan letra por letra: se quitan con su ×, o se borran enteras. */
  ignoreEvent(): boolean {
    return true;
  }
}

function etiquetas(view: EditorView): DecorationSet {
  // En modo fuente se ve el texto tal cual, para quien quiera editarlo a mano.
  if (!esDocGuion(view.state.doc) || !view.state.field(editorLivePreviewField, false)) return Decoration.none;
  const cats = contextoDe(view.state).cfg.categorias ?? CATEGORIAS;
  const b = new RangeSetBuilder<Decoration>();
  let ultima = -1;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const linea = view.state.doc.lineAt(pos);
      pos = linea.to + 1;
      if (linea.number <= ultima) continue;
      ultima = linea.number;
      const m = LINEA.exec(linea.text);
      if (!m) continue;
      const items = [...m[1].matchAll(MARCA)].map((x) => ({ cat: x[1], nombre: (x[3] ?? x[2]).trim(), cantidad: x[4] ? Number(x[4]) : 1 }));
      if (items.length && items.every((x) => x.nombre)) b.add(linea.from, linea.to, Decoration.replace({ widget: new Etiquetas(items, cats) }));
    }
  }
  return b.finish();
}

/**
 * Las marcas ocultas que agrega el breakdown se ven como etiquetas del color de su categoría. Son atómicas: el cursor
 * no entra a medias, así que un Retroceso no deja un `%%` sin cerrar que se trague las escenas siguientes.
 */
export const ocultasEditor = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = etiquetas(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false)) this.decorations = etiquetas(u.view);
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (p) => EditorView.atomicRanges.of((view) => view.plugin(p)?.decorations ?? Decoration.none),
  },
);
