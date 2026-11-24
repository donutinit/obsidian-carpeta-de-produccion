import { EditorView } from '@codemirror/view';
import { esDocGuion } from './doc';

/**
 * El editor de un guion lleva la clase `cp-guion-ed`: con ella, el CSS le da el ancho de la página (60 columnas de
 * Courier) aunque «Readable line length» esté apagado. Así las sangrías de personaje y diálogo quedan donde van.
 */
export const anchoGuion = EditorView.editorAttributes.compute(['doc'], (st): Record<string, string> => (esDocGuion(st.doc) ? { class: 'cp-guion-ed' } : {}));
