import { normalizePath, Notice, Platform, TFile, TFolder, type App, type Plugin } from 'obsidian';
import { construir, fuenteSides } from '../motor';
import { construirDe } from './guion';
import { leerConfigProyecto } from './proyecto';
import { textoDe } from './cambios';
import { ordenReparto } from './generar';
import { renderBreakdown } from './render/breakdown';
import { renderHojaOctavos, renderTablaOctavos } from './render/octavos';
import { renderGuion, tituloDe } from './render/papel';
import { renderLocaciones, renderReparto } from './render/listas';

export type DocumentoPDF = 'guion' | 'subrayado' | 'octavos' | 'breakdown';

export const NOMBRE_PDF: Record<DocumentoPDF, string> = {
  guion: 'Guion',
  subrayado: 'Guion subrayado',
  octavos: 'Hoja de octavos',
  breakdown: 'Breakdown',
};

/** El papel siempre en la paleta clara; las variables de Obsidian que usan las tablas, con valores fijos. */
const CSS_IMPRESION = `
@page { size: letter; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #111;
  --text-normal: #111; --text-muted: #4f5358; --text-faint: #6b7178; --text-error: #a51717;
  --background-primary: #fff; --background-secondary: #f4f5f7; --background-modifier-border: #c9ced3;
  --font-interface: "Helvetica Neue", Helvetica, Arial, sans-serif; --font-text: var(--font-interface); }
.cp-impresion .cp-pages, .cp-impresion .cp-pages-inner { zoom: 1 !important; padding: 0 !important; margin: 0 !important; }
.cp-impresion .cp-page { margin: 0 !important; box-shadow: none !important; break-after: page; }
.cp-impresion .cp-page:last-child { break-after: auto; }
.cp-impresion .cp-click { cursor: default; }
.cp-impresion .cp-bd { padding: 0.6in 0.6in 0.4in; font-family: var(--font-interface); font-size: 10pt; color: #111; }
.cp-impresion .cp-sheet { break-inside: avoid; }
.cp-impresion .cp-bd + .cp-bd { break-before: page; }
`;

async function asegurarCarpeta(app: App, ruta: string): Promise<void> {
  if (!(app.vault.getAbstractFileByPath(ruta) instanceof TFolder)) await app.vault.createFolder(ruta);
}

export const nombreArchivo = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Guion';

interface Electron {
  remote: { BrowserWindow: new (o: object) => VentanaElectron };
}
interface VentanaElectron {
  loadFile(ruta: string): Promise<void>;
  webContents: { printToPDF(o: object): Promise<Uint8Array> };
  destroy(): void;
}

/** Imprime el HTML de `caja` con una ventana oculta de Electron y lo escribe en `<proyecto>/Exportación/<nombre>.pdf`. */
async function imprimir(app: App, plugin: Plugin, guion: TFile, titulo: string, dibujar: (caja: HTMLElement) => void, nombre: string): Promise<TFile | null> {
  const caja = activeDocument.body.createDiv({ cls: 'carpeta-preview cp-impresion cp-impresion-oculta' });
  let html = '';
  try {
    dibujar(caja);
    html = caja.innerHTML;
  } finally {
    caja.remove();
  }
  const css = await app.vault.adapter.read(normalizePath(`${plugin.manifest.dir}/styles.css`));
  const pagina = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${css}\n${CSS_IMPRESION}</style></head><body class="theme-light"><div class="carpeta-preview cp-impresion">${html}</div></body></html>`;
  const req = (window as unknown as { require: (m: string) => unknown }).require;
  const electron = req('electron') as Electron;
  const fs = req('fs') as { writeFileSync(p: string, d: string): void; unlinkSync(p: string): void };
  const os = req('os') as { tmpdir(): string };
  const path = req('path') as { join(...p: string[]): string };
  const tmp = path.join(os.tmpdir(), `carpeta-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, pagina);
  const ventana = new electron.remote.BrowserWindow({ show: false, width: 850, height: 1100, webPreferences: { javascript: false } });
  let datos: Uint8Array;
  try {
    await ventana.loadFile(tmp);
    datos = await ventana.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  } finally {
    ventana.destroy();
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* el temporal ya no está */
    }
  }
  const dir = guion.parent && guion.parent.path !== '/' ? guion.parent.path + '/' : '';
  const carpeta = normalizePath(`${dir}Exportación`);
  await asegurarCarpeta(app, carpeta);
  const ruta = normalizePath(`${carpeta}/${nombre}.pdf`);
  const bytes = datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength) as ArrayBuffer;
  const previo = app.vault.getAbstractFileByPath(ruta);
  if (previo instanceof TFile) await app.vault.modifyBinary(previo, bytes);
  else await app.vault.createBinary(ruta, bytes);
  new Notice(`PDF listo: ${ruta}`);
  const hecho = app.vault.getAbstractFileByPath(ruta);
  return hecho instanceof TFile ? hecho : null;
}

const escritorio = () => {
  if (Platform.isDesktopApp) return true;
  new Notice('La exportación a PDF solo está en Obsidian de escritorio.');
  return false;
};

/**
 * Exporta un documento a PDF desde el mismo HTML de la vista previa, con una ventana oculta de
 * Electron. Escribe `<proyecto>/Exportación/<título> - <documento>.pdf`.
 */
export async function exportarPDF(app: App, plugin: Plugin, guion: TFile, documento: DocumentoPDF): Promise<TFile | null> {
  if (!escritorio()) return null;
  const g = await construirDe(app, guion, await textoDe(app, guion));
  if (!g.doc.escenas.length) {
    new Notice('El guion todavía no tiene escenas.');
    return null;
  }
  return imprimir(
    app,
    plugin,
    guion,
    NOMBRE_PDF[documento],
    (caja) => {
      if (documento === 'guion' || documento === 'subrayado') renderGuion(caja, g, { subrayado: documento === 'subrayado' });
      else if (documento === 'octavos') {
        renderHojaOctavos(caja, g, tituloDe(g));
        renderTablaOctavos(caja.createDiv({ cls: 'cp-bd' }), g);
      } else {
        renderBreakdown(caja, g);
        renderReparto(caja, g, ordenReparto(app, guion));
        renderLocaciones(caja, g);
      }
    },
    `${nombreArchivo(tituloDe(g) || guion.basename)} - ${NOMBRE_PDF[documento]}`,
  );
}

/** Sides de un actor: solo sus escenas, con sus números del guion completo y sus renglones resaltados. */
export async function exportarSides(app: App, plugin: Plugin, guion: TFile, personaje: string): Promise<TFile | null> {
  if (!escritorio()) return null;
  const texto = await textoDe(app, guion);
  const cfg = leerConfigProyecto(app, guion.path);
  const g = construir(fuenteSides(texto, personaje, cfg), cfg);
  if (!g.doc.escenas.length) {
    new Notice(`${personaje} no aparece en ninguna escena.`);
    return null;
  }
  const titulo = tituloDe(g) || guion.basename;
  return imprimir(app, plugin, guion, `Sides de ${personaje}`, (caja) => renderGuion(caja, g, { resaltar: personaje.toLocaleUpperCase('es') }), `${nombreArchivo(titulo)} - Sides de ${nombreArchivo(personaje)}`);
}
