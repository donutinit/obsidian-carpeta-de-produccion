import { EditorSelection, EditorState, MapMode, Prec, StateEffect, StateField, type Extension, type Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import {
  conversionAlTeclear,
  corregir,
  inicioDeParrafo,
  normalizarAlSalir,
  pulsarTecla,
  teclearParentesis,
  tipoEnCursor,
  type Deseado,
  type Edicion,
  type TeclaGuion,
  type TipoParrafo,
} from '../../motor';
import { preferencias } from '../ajustes';
import { diccionariosDe } from './contexto';
import { esDocGuion } from './doc';

/** El tipo deseado de la línea del cursor: `pos` es el inicio de esa línea. */
interface ValorDeseado {
  pos: number;
  tipo: TipoParrafo;
}

/** ¿La transacción cambia texto fuera de la línea que empieza en `pos` (en el documento de antes)? */
function cambiaFueraDeLinea(tr: Transaction, pos: number): boolean {
  if (pos > tr.startState.doc.length) return true;
  const l = tr.startState.doc.lineAt(pos);
  let fuera = false;
  // Fuera de la línea, o un salto de línea insertado (pegar varias líneas): el deseado ya no es de esta línea.
  tr.changes.iterChanges((a, b, _c, _d, insertado) => {
    if (a < l.from || b > l.to || insertado.lines > 1) fuera = true;
  });
  return fuera;
}

/** Fija el tipo deseado de la línea que contiene `pos` (en el documento ya cambiado), o lo borra. */
export const fijarDeseado = StateEffect.define<ValorDeseado | null>();

export const campoDeseado = StateField.define<ValorDeseado | null>({
  create: () => null,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(fijarDeseado)) return e.value ? { pos: tr.state.doc.lineAt(e.value.pos).from, tipo: e.value.tipo } : null;
    if (!v) return null;
    // Un cambio fuera de su línea (pegar, reemplazar toda la nota, mover escenas) lo pierde.
    if (tr.docChanged && cambiaFueraDeLinea(tr, v.pos)) return null;
    const pos = tr.docChanged ? tr.changes.mapPos(v.pos, -1, MapMode.TrackDel) : v.pos;
    if (pos === null) return null;
    const linea = tr.state.doc.lineAt(Math.min(pos, tr.state.doc.length));
    // Se borra en cuanto el cursor sale de la línea.
    if (tr.state.doc.lineAt(tr.state.selection.main.head).from !== linea.from) return null;
    // El mismo objeto si nada cambió, para no redibujar el formato en cada movimiento del cursor.
    return linea.from === v.pos ? v : { pos: linea.from, tipo: v.tipo };
  },
});

/** El deseado en el formato del motor (línea desde 0). */
export function deseadoDe(state: EditorState): Deseado | null {
  const v = state.field(campoDeseado, false);
  return v ? { linea: state.doc.lineAt(v.pos).number - 1, tipo: v.tipo } : null;
}

/** ¿Hay un autocompletado abierto? Entonces Enter y Tab son suyos. */
export const sugerencias = { abierta: false };

export function aplicar(view: EditorView, e: Edicion, userEvent = 'input.guion'): void {
  const efecto = fijarDeseado.of(e.deseado ? { pos: e.cursor, tipo: e.deseado } : null);
  if (e.nada) {
    view.dispatch({ effects: efecto });
    return;
  }
  view.dispatch({
    changes: { from: e.desde, to: e.hasta, insert: e.insertar },
    selection: EditorSelection.cursor(e.cursor),
    effects: efecto,
    userEvent,
    scrollIntoView: true,
  });
}

/** Lo que pasa después de aplicar una edición que pide sugerencias (lo conecta el sugeridor). */
export const alPedirSugerencias: { fn: ((view: EditorView) => void) | null } = { fn: null };

export function pulsar(view: EditorView, tecla: TeclaGuion): boolean {
  const st = view.state;
  if (!esDocGuion(st.doc) || sugerencias.abierta || st.selection.ranges.length > 1) return false;
  const { from, to } = st.selection.main;
  const e = pulsarTecla(st.doc.toString(), from, to, tecla, deseadoDe(st), diccionariosDe(st));
  if (!e) return false;
  aplicar(view, e);
  if (e.sugerir || e.deseado === 'personaje' || e.deseado === 'transicion') alPedirSugerencias.fn?.(view);
  return true;
}

/** Al teclear: paréntesis, correcciones y mayúsculas tras una conversión. */
// Antes que el autocierre de comillas y paréntesis de Obsidian.
const alTeclear = Prec.highest(EditorView.inputHandler.of((view, from, to, texto) => {
  const st = view.state;
  if (view.composing || !esDocGuion(st.doc) || st.selection.ranges.length > 1) return false;
  const doc = st.doc.toString();
  const deseado = deseadoDe(st);
  const dic = diccionariosDe(st);
  if ((texto === '(' || texto === ')') && from === to) {
    const e = teclearParentesis(doc, from, texto, deseado, dic);
    if (e) {
      aplicar(view, e, 'input.type');
      return true;
    }
  }
  if (texto.length !== 1) return false;
  const tipo = tipoEnCursor(doc, from, deseado, dic);
  if (!tipo) return false;
  const linea = st.doc.lineAt(from);
  if (to > linea.to) return false;
  const antes = st.doc.sliceString(linea.from, from);
  const despues = st.doc.sliceString(to, linea.to);
  const c = corregir(antes, despues, texto, tipo, inicioDeParrafo(doc, linea.number - 1, deseado, dic), preferencias.actual.correcciones);
  const insertar = c ? c.insertar : texto;
  const desde = from - (c?.borrar ?? 0);
  let nueva = st.doc.sliceString(linea.from, desde) + insertar + despues;
  let cursor = desde + insertar.length;
  if (/[.\s:]/.test(texto)) {
    const lineas = doc.split('\n');
    lineas[linea.number - 1] = nueva;
    const convertida = conversionAlTeclear(lineas.join('\n'), linea.number - 1, dic);
    if (convertida !== null && convertida.length === nueva.length) nueva = convertida;
  }
  if (!c && nueva === st.doc.sliceString(linea.from, from) + texto + despues) return false;
  cursor = Math.min(cursor, linea.from + nueva.length);
  view.dispatch({
    changes: { from: linea.from, to: linea.to, insert: nueva },
    selection: EditorSelection.cursor(cursor),
    userEvent: 'input.type',
  });
  return true;
}));

/** Al salir de una línea con tipo deseado, se escribe como Fountain válido (mayúsculas, `.`, `>`, `!!`…). */
const filtroNormalizar = EditorState.transactionFilter.of((tr: Transaction) => {
  const antes = tr.startState.field(campoDeseado, false);
  if (!antes || tr.effects.some((e) => e.is(fijarDeseado)) || !esDocGuion(tr.newDoc)) return tr;
  if (tr.docChanged && cambiaFueraDeLinea(tr, antes.pos)) return tr;
  const pos = tr.docChanged ? tr.changes.mapPos(antes.pos, -1, MapMode.TrackDel) : antes.pos;
  if (pos === null || pos > tr.newDoc.length) return tr;
  const linea = tr.newDoc.lineAt(pos);
  if (tr.newDoc.lineAt(tr.newSelection.main.head).from === linea.from) return tr;
  const nueva = normalizarAlSalir(tr.newDoc.toString(), linea.number - 1, antes.tipo, diccionariosDe(tr.startState));
  if (nueva === null) return tr;
  return [tr, { changes: { from: linea.from, to: linea.to, insert: nueva }, sequential: true }];
});

/** Enter, Tab, Shift+Tab y Shift+Enter del guion (solo en notas con `carpeta: guion`). */
export function teclasGuion(): Extension {
  return [
    campoDeseado,
    filtroNormalizar,
    alTeclear,
    Prec.highest(
      keymap.of([
        { key: 'Enter', run: (v) => pulsar(v, 'Enter') },
        { key: 'Tab', run: (v) => pulsar(v, 'Tab') },
        { key: 'Shift-Tab', run: (v) => pulsar(v, 'Shift-Tab') },
        { key: 'Shift-Enter', run: (v) => pulsar(v, 'Shift-Enter') },
      ]),
    ),
  ];
}
