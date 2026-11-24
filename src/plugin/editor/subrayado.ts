import { EditorSelection, Prec } from '@codemirror/state';
import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Notice } from 'obsidian';
import { aplicarMarca, CATEGORIAS, type Categoria } from '../../motor';
import { claseCategoria } from '../render/papel';
import { contextoDe } from './contexto';
import { esDocGuion } from './formato';

export const AVISO_ENCIMADA = 'La selección se encima con otra marca.';
export const AVISO_VARIAS_LINEAS = 'Selecciona texto de una sola línea.';

const categoriasDe = (view: EditorView): Categoria[] => contextoDe(view.state).cfg.categorias ?? CATEGORIAS;

const decorador = new MatchDecorator({
  regexp: /\{([a-z]+):[^{}\n]*?\}/g,
  decoration: (m, view) => Decoration.mark({ class: 'cp-ed-tag cp-t ' + claseCategoria(m[1], categoriasDe(view)) }),
});

/** Pinta las marcas `{código:texto}` con el color de su categoría. */
export const marcasEditor = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = esDocGuion(view.state.doc) ? decorador.createDeco(view) : Decoration.none;
    }
    update(u: ViewUpdate) {
      if (!esDocGuion(u.state.doc)) this.decorations = Decoration.none;
      else if (this.decorations === Decoration.none) this.decorations = decorador.createDeco(u.view);
      else this.decorations = decorador.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Aplica, cambia o quita la categoría en la selección. Devuelve `true` si consumió la tecla. */
export function subrayar(view: EditorView, codigo: string): boolean {
  const st = view.state;
  const sel = st.selection.main;
  if (sel.empty || !esDocGuion(st.doc)) return false;
  const linea = st.doc.lineAt(sel.from);
  let hasta = sel.to;
  // Seleccionar una línea entera deja el final al inicio de la siguiente.
  if (hasta > linea.to && st.doc.lineAt(hasta).from === hasta && st.doc.lineAt(hasta).number === linea.number + 1) hasta = linea.to;
  if (hasta > linea.to) {
    new Notice(AVISO_VARIAS_LINEAS);
    return true;
  }
  const r = aplicarMarca(linea.text, sel.from - linea.from, hasta - linea.from, codigo, new Set(categoriasDe(view).map((c) => c.codigo)));
  if (r.tipo === 'ignorar') return false;
  if (r.tipo === 'encimada') {
    new Notice(AVISO_ENCIMADA);
    return true;
  }
  view.dispatch({
    changes: { from: linea.from + r.desde, to: linea.from + r.hasta, insert: r.texto },
    selection: EditorSelection.cursor(linea.from + r.cursor),
    userEvent: 'input.subrayado',
  });
  return true;
}

/**
 * Subrayado por teclas: con selección, 1–0 y Shift+1–3. Se lee la tecla física (`event.code`)
 * para que Shift+1..3 funcione en cualquier distribución de teclado.
 */
export const teclasSubrayado = Prec.highest(
  EditorView.domEventHandlers({
    keydown(e, view) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return false;
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
      if (!m) return false;
      const tecla = (e.shiftKey ? 'Shift-' : '') + m[1];
      const codigo = categoriasDe(view).find((c) => c.tecla === tecla)?.codigo;
      if (!codigo || !subrayar(view, codigo)) return false;
      e.preventDefault();
      return true;
    },
  }),
);
