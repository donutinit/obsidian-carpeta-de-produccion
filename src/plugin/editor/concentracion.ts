import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { bloqueDeLinea } from '../../motor';
import { preferencias } from '../ajustes';
import { esDocGuion } from './doc';

/** Máquina de escribir: la línea del cursor se queda a media ventana después de escribir o moverse con el teclado. */
const maquina = EditorView.updateListener.of((u: ViewUpdate) => {
  const activa = preferencias.actual.maquinaDeEscribir && esDocGuion(u.state.doc);
  // Espacio al final para que las últimas líneas también puedan quedar a media ventana.
  u.view.dom.classList.toggle('cp-maquina', activa);
  if (!activa) return;
  // Teclear, borrar o moverse con el teclado (CodeMirror marca las flechas como «select», el clic como «select.pointer»).
  const deUsuario = u.transactions.some((t) => t.isUserEvent('input') || t.isUserEvent('delete') || (t.isUserEvent('select') && !t.isUserEvent('select.pointer')) || t.isUserEvent('move'));
  if (!deUsuario) return;
  const cabeza = u.state.selection.main.head;
  window.setTimeout(() => u.view.dispatch({ effects: EditorView.scrollIntoView(cabeza, { y: 'center' }) }), 0);
});

/** Enfoque: atenúa las líneas visibles fuera del párrafo (o bloque de diálogo) del cursor. */
const enfoque = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    constructor(view: EditorView) {
      this.decorations = this.calcular(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged) this.decorations = this.calcular(u.view);
    }
    calcular(view: EditorView): DecorationSet {
      const st = view.state;
      if (!preferencias.actual.enfoque || !esDocGuion(st.doc)) return Decoration.none;
      const linea = st.doc.lineAt(st.selection.main.head).number - 1;
      const [ini, fin] = bloqueDeLinea(st.doc.toString(), linea);
      const b = new RangeSetBuilder<Decoration>();
      const atenuar = Decoration.line({ class: 'cp-ed-atenuado' });
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          const l = st.doc.lineAt(pos);
          if (l.number - 1 < ini || l.number - 1 > fin) b.add(l.from, l.from, atenuar);
          pos = l.to + 1;
        }
      }
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const decoradorProfe = new MatchDecorator({
  regexp: /%%>[^%]*(?:%(?!%)[^%]*)*%%/g,
  decoration: (m) => Decoration.mark({ class: 'cp-ed-profe' + (m[0].startsWith('%%>✓') ? ' cp-ed-profe-resuelto' : '') }),
});

/** Los comentarios del profesor (`%%>Autor: …%%`) se ven distintos de una guía. */
const comentariosProfe = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = esDocGuion(view.state.doc) ? decoradorProfe.createDeco(view) : Decoration.none;
    }
    update(u: ViewUpdate) {
      if (!esDocGuion(u.state.doc)) this.decorations = Decoration.none;
      else if (this.decorations === Decoration.none || u.viewportChanged) this.decorations = decoradorProfe.createDeco(u.view);
      else this.decorations = decoradorProfe.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

export const concentracion = [maquina, enfoque, comentariosProfe];
