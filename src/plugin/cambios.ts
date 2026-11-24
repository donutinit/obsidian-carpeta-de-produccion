import { MarkdownView, Notice, TFile, type App } from 'obsidian';
import type { Cambio } from '../motor';

/** La vista de Markdown donde está abierta la nota, si hay. */
export function vistaDe(app: App, ruta: string): MarkdownView | null {
  const vistas = app.workspace
    .getLeavesOfType('markdown')
    .map((l) => l.view)
    .filter((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === ruta);
  // Si está abierta en varias pestañas, la que se edita.
  return vistas.find((v) => v.getMode() === 'source') ?? vistas[0] ?? null;
}

/** El texto vigente de la nota: el del editor si está abierta (puede no estar guardado), o el del archivo. */
export async function textoDe(app: App, f: TFile): Promise<string> {
  const v = vistaDe(app, f.path);
  return v && v.getMode() === 'source' ? v.editor.getValue() : app.vault.read(f);
}

/**
 * Aplica cambios calculados sobre el texto vigente, en una sola transacción (Ctrl+Z la deshace entera).
 * `calcular` recibe el texto actual, para que los desplazamientos correspondan.
 * Con `abrir: false` no abre el guion si está cerrado: escribe el archivo y quien lo pidió sigue donde estaba.
 */
export async function aplicarCambios(app: App, f: TFile, calcular: (texto: string) => Cambio[], opciones: { abrir?: boolean } = {}): Promise<number> {
  const abierta = vistaDe(app, f.path);
  // En la vista de lectura el editor no guarda lo que se le escribe: ahí se escribe el archivo.
  let v = abierta && abierta.getMode() === 'source' ? abierta : null;
  if (!abierta && opciones.abrir !== false) {
    // Para que Ctrl+Z pueda deshacerlo, el cambio se hace en el editor: se abre el guion en una pestaña nueva.
    const hoja = app.workspace.getLeaf('tab');
    await hoja.openFile(f, { active: false });
    v = hoja.view instanceof MarkdownView && hoja.view.file?.path === f.path ? hoja.view : null;
    if (v) new Notice('Abrí el guion en una pestaña nueva: ahí puedes deshacer el cambio con Ctrl+Z.');
  }
  if (v) {
    const ed = v.editor;
    const cambios = calcular(ed.getValue());
    if (cambios.length) ed.transaction({ changes: cambios.map((c) => ({ from: ed.offsetToPos(c.desde), to: ed.offsetToPos(c.hasta), text: c.texto })) });
    return cambios.length;
  }
  let n = 0;
  await app.vault.process(f, (t) => {
    const cambios = calcular(t);
    n = cambios.length;
    return [...cambios].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);
  });
  return n;
}
