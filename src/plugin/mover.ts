import { MarkdownView, Notice, TFile, type App } from 'obsidian';
import { analizar, moverEscena, resumenEscena, type Cambio, type Guion } from '../motor';

/** Tipo propio del arrastre de escenas: soltar en el editor no escribe nada en el guion. */
export const MIME_ESCENA = 'application/x-carpeta-escena';

export interface EscenaArrastrada {
  k: number;
  encabezado: string;
}

const COLORES = new Set(['azul', 'rojo', 'verde', 'amarillo', 'naranja', 'morado', 'rosa', 'gris']);
const LARGO_RESUMEN = 90;

/** Pinta la barra de color de una escena: un nombre de la lista o un #hex. */
export function pintarColor(el: HTMLElement, color?: string): void {
  const c = (color ?? '').trim().toLowerCase();
  if (COLORES.has(c)) el.addClass('cp-color-' + c);
  else if (/^#[0-9a-f]{3,8}$/.test(c)) el.setCssStyles({ background: c });
}

/** La sinopsis «=» de la escena o, si no hay, el inicio de su primera acción. */
export const resumen = (g: Guion, k: number, largo = LARGO_RESUMEN): string => resumenEscena(g, k, largo);

/**
 * Mueve una escena a la posición de otra en una sola transacción (Ctrl+Z la deshace entera). Las escenas se
 * vuelven a buscar en el texto vigente por su índice y su encabezado: si el guion cambió desde que se dibujó
 * la lista, no se mueve nada.
 */
export async function moverEscenaEnNota(app: App, ruta: string, desde: number | EscenaArrastrada, hacia: number | EscenaArrastrada): Promise<void> {
  const de = typeof desde === 'number' ? { k: desde, encabezado: null } : desde;
  const a = typeof hacia === 'number' ? { k: hacia, encabezado: null } : hacia;
  const calcular = (t: string) => {
    const escenas = analizar(t).escenas;
    const vale = (x: { k: number; encabezado: string | null }) => escenas[x.k] && (x.encabezado === null || escenas[x.k].encabezado === x.encabezado);
    return vale(de) && vale(a) ? moverEscena(t, de.k, a.k) : undefined;
  };
  const hoja = app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === ruta);
  let c: Cambio | null | undefined;
  if (hoja && hoja.view instanceof MarkdownView) {
    const ed = hoja.view.editor;
    c = calcular(ed.getValue());
    if (c) ed.transaction({ changes: [{ from: ed.offsetToPos(c.desde), to: ed.offsetToPos(c.hasta), text: c.texto }] });
  } else {
    const f = app.vault.getAbstractFileByPath(ruta);
    if (!(f instanceof TFile)) return;
    await app.vault.process(f, (t) => {
      c = calcular(t);
      return c ? t.slice(0, c.desde) + c.texto + t.slice(c.hasta) : t;
    });
  }
  if (c === undefined) new Notice('El guion cambió mientras arrastrabas; vuelve a intentarlo.');
}
