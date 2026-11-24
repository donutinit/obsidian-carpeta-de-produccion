import { Modal, normalizePath, Notice, Setting, TFile, TFolder, type App, type Plugin } from 'obsidian';
import { analizarEnLinea, construir, exportarFDX, exportarFountain, importarFDX, importarFountain, textoPlano } from '../motor';
import { textoDe } from './cambios';
import { guionActivo } from './comandos-produccion';
import { exportarPDF, NOMBRE_PDF, nombreArchivo, type DocumentoPDF } from './pdf';
import { leerConfigProyecto } from './proyecto';

async function escribir(app: App, ruta: string, texto: string): Promise<void> {
  const dir = ruta.slice(0, ruta.lastIndexOf('/'));
  if (dir && !(app.vault.getAbstractFileByPath(dir) instanceof TFolder)) await app.vault.createFolder(dir);
  const previo = app.vault.getAbstractFileByPath(ruta);
  if (previo instanceof TFile) await app.vault.modify(previo, texto);
  else await app.vault.create(ruta, texto);
}

async function exportarTexto(app: App, guion: TFile, formato: 'limpio' | 'completo' | 'fdx'): Promise<void> {
  const texto = await textoDe(app, guion);
  const cfg = leerConfigProyecto(app, guion.path);
  const crudo = (construir(texto, cfg).doc.portada.title ?? [])[0] ?? '';
  const titulo = nombreArchivo(textoPlano(analizarEnLinea(crudo)).replace(/[*_]/g, '') || guion.basename);
  const dir = guion.parent && guion.parent.path !== '/' ? guion.parent.path + '/' : '';
  const nombre = formato === 'fdx' ? `${titulo}.fdx` : formato === 'completo' ? `${titulo} (completo).fountain` : `${titulo}.fountain`;
  const ruta = normalizePath(`${dir}Exportación/${nombre}`);
  await escribir(app, ruta, formato === 'fdx' ? exportarFDX(texto, cfg) : exportarFountain(texto, formato, cfg));
  new Notice(`Exportado: ${ruta}`);
}

/** Pide un archivo .fountain o .fdx del sistema y lo convierte en una nota de guion nueva (nunca reemplaza otra). */
class ModalImportar extends Modal {
  onOpen() {
    this.titleEl.setText('Importar guion');
    this.contentEl.createEl('p', { text: 'Elige un archivo .fountain o .fdx. Se crea una nota de guion nueva en la carpeta de la nota activa.' });
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText('Elegir archivo…')
        .setCta()
        .onClick(() => {
          const input = createEl('input', { attr: { type: 'file', accept: '.fountain,.fdx,.txt,.spmd' } });
          input.onchange = async () => {
            const archivo = input.files?.[0];
            if (!archivo) return;
            try {
              const texto = await archivo.text();
              const esFdx = /\.fdx$/i.test(archivo.name) || /<FinalDraft\b/.test(texto);
              const nota = esFdx ? importarFDX(texto) : importarFountain(texto);
              // En una subcarpeta: junto al guion del proyecto, la copia importada podría tomar su lugar en las listas.
              const activa = this.app.workspace.getActiveFile();
              const base0 = activa?.parent && activa.parent.path !== '/' ? activa.parent.path + '/' : '';
              const dir = normalizePath(`${base0}Importados`);
              if (!(this.app.vault.getAbstractFileByPath(dir) instanceof TFolder)) await this.app.vault.createFolder(dir);
              const base = nombreArchivo(archivo.name.replace(/\.[^.]+$/, ''));
              let ruta = normalizePath(`${dir}/${base}.md`);
              for (let n = 2; this.app.vault.getAbstractFileByPath(ruta); n++) ruta = normalizePath(`${dir}/${base} (${n}).md`);
              const f = await this.app.vault.create(ruta, nota);
              this.close();
              await this.app.workspace.getLeaf('tab').openFile(f);
              new Notice(`Guion importado: ${ruta}`);
            } catch (e) {
              console.error(e);
              new Notice('No se pudo importar: ' + (e instanceof Error ? e.message : String(e)));
            }
          };
          input.click();
        }),
    );
  }
  onClose() {
    this.contentEl.empty();
  }
}

export function registrarEntrega(plugin: Plugin): void {
  const app = plugin.app;
  const conGuion = (id: string, name: string, fn: (g: TFile) => Promise<unknown>) =>
    plugin.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const g = guionActivo(app);
        if (!g) return false;
        if (!checking)
          fn(g).catch((e: unknown) => {
            console.error(e);
            new Notice('No se pudo exportar: ' + (e instanceof Error ? e.message : String(e)));
          });
        return true;
      },
    });
  for (const doc of ['guion', 'subrayado', 'octavos', 'breakdown'] as DocumentoPDF[]) {
    conGuion(`pdf-${doc}`, `Exportar PDF: ${NOMBRE_PDF[doc].toLowerCase()}`, (g) => exportarPDF(app, plugin, g, doc));
  }
  conGuion('exportar-fountain', 'Exportar guion a Fountain (limpio)', (g) => exportarTexto(app, g, 'limpio'));
  conGuion('exportar-fountain-completo', 'Exportar guion a Fountain (completo, para volver a importarlo)', (g) => exportarTexto(app, g, 'completo'));
  conGuion('exportar-fdx', 'Exportar guion a Final Draft (FDX)', (g) => exportarTexto(app, g, 'fdx'));
  plugin.addCommand({ id: 'importar-guion', name: 'Importar guion (Fountain o FDX)', callback: () => new ModalImportar(app).open() });
}
