import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { esDocGuion } from './doc';

/** Quienes quieren saber en qué línea del guion está el cursor (el navegador de escenas). */
export const oyentesCursor = new Set<(ruta: string, linea: number) => void>();

export const seguidorCursor = ViewPlugin.fromClass(
  class {
    private ultima = -1;
    update(u: ViewUpdate) {
      if (!oyentesCursor.size || !(u.selectionSet || u.docChanged || u.focusChanged)) return;
      const ruta = u.state.field(editorInfoField, false)?.file?.path;
      if (!ruta || !esDocGuion(u.state.doc)) return;
      const linea = u.state.doc.lineAt(u.state.selection.main.head).number - 1;
      if (linea === this.ultima && !u.docChanged && !u.focusChanged) return;
      this.ultima = linea;
      for (const f of oyentesCursor) f(ruta, linea);
    }
  },
);
