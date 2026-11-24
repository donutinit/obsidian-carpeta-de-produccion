import { debounce, ItemView, MarkdownView, TFile, type WorkspaceLeaf } from 'obsidian';
import { CATEGORIAS, segundosAproximados, type Categoria } from '../motor';
import { construirDe } from './guion';
import { buscarGuion, buscarProyecto } from './proyecto';
import { renderHojaOctavos } from './render/octavos';
import { claseCategoria, renderGuion, tituloDe } from './render/papel';

export const VISTA_GUION = 'carpeta-vista-guion';

export const teclaVisible = (tecla: string) => tecla.replace('Shift-', '⇧');

const ORDEN_TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Shift-1', 'Shift-2', 'Shift-3', 'Shift-4', 'Shift-5', 'Shift-6', 'Shift-7', 'Shift-8', 'Shift-9'];
/** Las categorías en el orden del teclado, para la clave de teclas. */
export const porTecla = (cats: Categoria[] = CATEGORIAS) => [...cats].sort((a, b) => ORDEN_TECLAS.indexOf(a.tecla) - ORDEN_TECLAS.indexOf(b.tecla));

export class VistaPrevia extends ItemView {
  ruta: string | null = null;
  subrayado = false;
  octavos = false;
  private pendiente = debounce((texto?: string) => void this.render(texto), 250, true);

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VISTA_GUION;
  }
  getDisplayText() {
    return 'Vista previa del guion';
  }
  getIcon() {
    return 'clapperboard';
  }

  async onOpen() {
    this.addAction('ruler', 'Hoja de octavos', () => this.alternar('octavos'));
    this.addAction('highlighter', 'Subrayado', () => this.alternar('subrayado'));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.seguirActiva()));
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, info) => {
        if (info?.file && info.file.path === this.ruta) this.pendiente(editor.getValue());
      }),
    );
    this.registerEvent(
      this.app.vault.on('modify', (f) => {
        if (f.path === this.ruta) this.pendiente();
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on('changed', (f) => {
        // La nota activa acaba de volverse guion (o de cambiar de proyecto).
        if (f.path === this.app.workspace.getActiveFile()?.path) this.seguirActiva();
        // Cambió una propiedad del proyecto (renglones por página, textos de continuación…).
        const g = this.ruta && this.app.vault.getAbstractFileByPath(this.ruta);
        if (g instanceof TFile && buscarProyecto(this.app, g)?.path === f.path) this.pendiente();
      }),
    );
    this.seguirActiva(true);
  }

  alternar(modo: 'subrayado' | 'octavos') {
    this[modo] = !this[modo];
    void this.render();
  }

  /** Sigue al proyecto de la nota activa: si es el guion, ese; si no, el guion de su carpeta. */
  seguirActiva(forzar = false) {
    const f = this.app.workspace.getActiveFile();
    const g = f && f.extension === 'md' ? buscarGuion(this.app, f.path) : null;
    if (g && (forzar || g.path !== this.ruta)) {
      this.ruta = g.path;
      void this.render();
    } else if (forzar && !this.ruta) void this.render();
  }

  async render(texto?: string) {
    const el = this.contentEl;
    const arriba = el.scrollTop;
    el.empty();
    el.addClass('carpeta-preview');
    const archivo = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    if (!(archivo instanceof TFile)) {
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion (con «carpeta: guion» en sus propiedades) para verla paginada.' });
      return;
    }
    const g = await construirDe(this.app, archivo, texto, { equipo: false });
    const barra = el.createDiv({ cls: 'cp-bar' });
    const paginas = g.paginas.length;
    const escenas = g.doc.escenas.length;
    const minutos = Math.round(segundosAproximados(g.octavos.total) / 60);
    const modo = this.octavos ? ' · hoja de octavos' : this.subrayado ? ' · subrayado' : '';
    barra.createDiv({
      text: `${paginas} ${paginas === 1 ? 'página' : 'páginas'} · ${escenas} ${escenas === 1 ? 'escena' : 'escenas'} · ${g.octavos.total}/8 · ≈ ${minutos} min${modo}`,
    });
    const claves = barra.createDiv({ cls: 'cp-keys' });
    for (const c of porTecla(g.config.categorias)) {
      const it = claves.createSpan({ cls: 'cp-keys-item' });
      it.createSpan({ cls: 'cp-key', text: teclaVisible(c.tecla) });
      it.createSpan({ cls: 'cp-mark ' + claseCategoria(c.codigo, g.config.categorias), text: c.nombre });
    }
    const saltar = (linea: number) => this.saltar(linea);
    if (this.octavos) renderHojaOctavos(el, g, tituloDe(g), { alSaltar: saltar });
    else renderGuion(el, g, { subrayado: this.subrayado, alSaltar: saltar });
    el.scrollTop = arriba;
  }

  saltar(linea: number) {
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ruta);
    if (!hoja || !(hoja.view instanceof MarkdownView)) return;
    this.app.workspace.setActiveLeaf(hoja, { focus: true });
    const ed = hoja.view.editor;
    ed.setCursor({ line: linea, ch: 0 });
    ed.scrollIntoView({ from: { line: linea, ch: 0 }, to: { line: linea, ch: 0 } }, true);
  }
}
