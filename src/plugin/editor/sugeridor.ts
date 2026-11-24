import type { EditorView } from '@codemirror/view';
import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestTriggerInfo, type TFile } from 'obsidian';
import { sugerir, tipoEnCursor, type Sugerencia } from '../../motor';
import { preferencias } from '../ajustes';
import { diccionariosDe, fichasDelProyecto } from './contexto';
import { esDocGuion } from './doc';
import { alPedirSugerencias, deseadoDe, pulsar, sugerencias } from './teclas';

export const cmDe = (editor: Editor | null | undefined): EditorView | null => (editor as unknown as { cm?: EditorView } | null)?.cm ?? null;

interface ConSugerencias {
  suggestions?: { useSelectedItem(evt: KeyboardEvent): void };
}

/** Autocompletado del guion: encabezado por partes, personaje, extensión y transición. */
export class Sugeridor extends EditorSuggest<Sugerencia> {
  private lista: Sugerencia[] = [];

  constructor(app: App) {
    super(app);
    this.limit = 10;
    this.setInstructions([
      { command: 'Enter', purpose: 'aceptar y seguir' },
      { command: 'Tab', purpose: 'aceptar' },
      { command: 'Esc', purpose: 'cerrar' },
    ]);
    // Tab acepta sin saltar al siguiente párrafo.
    this.scope.register([], 'Tab', (evt) => {
      const s = (this as unknown as ConSugerencias).suggestions;
      if (s) s.useSelectedItem(evt);
      else this.close();
      return false;
    });
    alPedirSugerencias.fn = (view) => this.forzar(view);
  }

  open(): void {
    super.open();
    sugerencias.abierta = true;
  }

  close(): void {
    super.close();
    sugerencias.abierta = false;
  }

  /** Abre la lista aunque el texto no haya cambiado (Tab a personaje en una línea vacía). */
  forzar(view: EditorView): void {
    const editor = this.app.workspace.activeEditor?.editor;
    const file = this.app.workspace.activeEditor?.file ?? null;
    if (!editor || cmDe(editor) !== view) return;
    const ws = this.app.workspace as unknown as { editorSuggest?: { trigger?(e: Editor, f: TFile | null, abrir: boolean): void } };
    ws.editorSuggest?.trigger?.(editor, file, true);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!preferencias.actual.autocompletado || !file) return null;
    const cm = cmDe(editor);
    if (!cm || !esDocGuion(cm.state.doc) || !cm.state.selection.main.empty) return null;
    const texto = cm.state.doc.toString();
    const pos = editor.posToOffset(cursor);
    const dic = diccionariosDe(cm.state);
    const tipo = tipoEnCursor(texto, pos, deseadoDe(cm.state), dic);
    if (tipo !== 'encabezado' && tipo !== 'personaje' && tipo !== 'transicion') return null;
    this.lista = sugerir(texto, pos, tipo, dic, fichasDelProyecto(this.app, file.path));
    if (!this.lista.length) return null;
    return { start: { line: cursor.line, ch: this.lista[0].desde }, end: cursor, query: '' };
  }

  getSuggestions(): Sugerencia[] {
    return this.lista;
  }

  renderSuggestion(s: Sugerencia, el: HTMLElement): void {
    el.addClass('cp-sug');
    el.setText(s.texto.trimEnd());
  }

  selectSuggestion(s: Sugerencia, evt: MouseEvent | KeyboardEvent): void {
    const ctx = this.context;
    if (!ctx) return;
    const ed = ctx.editor;
    // Una extensión cierra su paréntesis: si el autocierre de Obsidian ya puso uno, se reemplaza en vez de duplicarlo.
    const fin = s.texto.endsWith(')') && ed.getLine(ctx.end.line).charAt(ctx.end.ch) === ')' ? { line: ctx.end.line, ch: ctx.end.ch + 1 } : ctx.end;
    ed.replaceRange(s.texto, { line: ctx.start.line, ch: s.desde }, fin);
    ed.setCursor({ line: ctx.start.line, ch: s.desde + s.texto.length });
    this.close();
    const cm = cmDe(ed);
    // Enter en la última parte (momento, nombre, extensión, transición) acepta y salta al siguiente párrafo.
    if (cm && s.final && evt instanceof KeyboardEvent && evt.key === 'Enter') pulsar(cm, 'Enter');
  }
}
