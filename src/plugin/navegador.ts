import { debounce, ItemView, MarkdownView, TFile, type WorkspaceLeaf } from 'obsidian';
import {
  contarPalabras,
  duracionEscenas,
  duracionTotal,
  escenaEnLinea,
  formatearDuracion,
  formatearOctavos,
  type Guion,
} from '../motor';
import { oyentesCursor } from './editor/cursor';
import { MIME_ESCENA, moverEscenaEnNota, pintarColor, resumen, type EscenaArrastrada } from './mover';
import { construirDe } from './guion';
import { buscarGuion, buscarProyecto } from './proyecto';

export const VISTA_NAVEGADOR = 'carpeta-navegador';

/** Navegador de escenas: número, encabezado, color, octavos, duración y resumen; ir y reordenar. */
export class Navegador extends ItemView {
  ruta: string | null = null;
  private g: Guion | null = null;
  private filas: HTMLElement[] = [];
  private actual = -1;
  private arrastrada = -1;
  private pendiente = debounce((texto?: string) => void this.render(texto), 300, true);
  private alCursor = (ruta: string, linea: number) => {
    if (ruta === this.ruta && this.g) this.resaltar(escenaEnLinea(this.g.doc.escenas, linea));
  };

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  getViewType() {
    return VISTA_NAVEGADOR;
  }
  getDisplayText() {
    return 'Escenas';
  }
  getIcon() {
    return 'list-ordered';
  }

  async onOpen() {
    oyentesCursor.add(this.alCursor);
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
        const g = this.ruta && this.app.vault.getAbstractFileByPath(this.ruta);
        if (g instanceof TFile && buscarProyecto(this.app, g)?.path === f.path) this.pendiente();
      }),
    );
    this.seguirActiva(true);
  }

  async onClose() {
    oyentesCursor.delete(this.alCursor);
  }

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
    el.addClass('cp-nav');
    const archivo = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    if (!(archivo instanceof TFile)) {
      this.g = null;
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion para ver sus escenas.' });
      return;
    }
    const g = await construirDe(this.app, archivo, texto);
    this.g = g;
    const dur = duracionEscenas(g);
    const lista = el.createDiv({ cls: 'cp-nav-lista' });
    this.filas = g.doc.escenas.map((e, k) => {
      const fila = lista.createDiv({ cls: 'cp-nav-escena', attr: { draggable: 'true', 'aria-label': `Escena ${e.numero}` } });
      pintarColor(fila.createDiv({ cls: 'cp-nav-color' }), e.meta.color);
      const cuerpo = fila.createDiv({ cls: 'cp-nav-cuerpo' });
      const cab = cuerpo.createDiv({ cls: 'cp-nav-cab' });
      cab.createSpan({ cls: 'cp-nav-num', text: e.numero });
      cab.createSpan({ cls: 'cp-nav-enc', text: e.encabezado });
      cab.createSpan({ cls: 'cp-nav-dur', text: `${formatearOctavos(g.octavos.porEscena[k] ?? 0)} · ${formatearDuracion(dur[k] ?? 0)}` });
      const r = resumen(g, k);
      if (r) cuerpo.createDiv({ cls: 'cp-nav-res', text: r });
      fila.onclick = () => this.saltar(e.linea);
      fila.addEventListener('dragstart', (ev) => {
        // Un tipo propio (no text/plain): soltar la fila en el editor no escribe nada en el guion.
        ev.dataTransfer?.setData(MIME_ESCENA, JSON.stringify({ ruta: this.ruta, encabezado: e.encabezado, k }));
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
        this.arrastrada = k;
        fila.addClass('is-arrastrada');
      });
      fila.addEventListener('dragend', () => {
        this.arrastrada = -1;
        fila.removeClass('is-arrastrada');
        this.filas.forEach((f) => f.removeClass('cp-nav-sobre'));
      });
      fila.addEventListener('dragover', (ev) => {
        if (this.arrastrada < 0 || !ev.dataTransfer?.types.includes(MIME_ESCENA)) return;
        ev.preventDefault();
        this.filas.forEach((f) => f.toggleClass('cp-nav-sobre', f === fila && k !== this.arrastrada));
      });
      fila.addEventListener('drop', (ev) => {
        const datos = ev.dataTransfer?.getData(MIME_ESCENA);
        this.arrastrada = -1;
        if (!datos) return;
        ev.preventDefault();
        const { ruta, encabezado, k: desde } = JSON.parse(datos) as { ruta: string; encabezado: string; k: number };
        if (ruta === this.ruta && desde !== k) void this.mover({ k: desde, encabezado }, { k, encabezado: e.encabezado });
      });
      return fila;
    });
    if (!g.doc.escenas.length) lista.createDiv({ cls: 'cp-msg', text: 'No hay escenas todavía.' });
    const paginas = g.paginas.length;
    el.createDiv({
      cls: 'cp-nav-pie',
      text: `${paginas} ${paginas === 1 ? 'página' : 'páginas'} · ${g.doc.escenas.length} escenas · ${formatearOctavos(g.octavos.total)} · ${formatearDuracion(duracionTotal(g))} · ${contarPalabras(g.doc)} palabras`,
    });
    if (this.actual >= 0) this.resaltar(this.actual);
    el.scrollTop = arriba;
  }

  resaltar(k: number) {
    this.actual = k;
    this.filas.forEach((f, i) => f.toggleClass('is-actual', i === k));
  }

  private editorAbierto(): MarkdownView | null {
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ruta);
    return hoja && hoja.view instanceof MarkdownView ? hoja.view : null;
  }

  saltar(linea: number) {
    const v = this.editorAbierto();
    if (!v) {
      const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
      if (f instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(f, { eState: { line: linea } });
      return;
    }
    this.app.workspace.setActiveLeaf(v.leaf, { focus: true });
    v.editor.setCursor({ line: linea, ch: 0 });
    v.editor.scrollIntoView({ from: { line: linea, ch: 0 }, to: { line: linea, ch: 0 } }, true);
  }

  async mover(desde: number | EscenaArrastrada, hacia: number | EscenaArrastrada) {
    if (this.ruta) await moverEscenaEnNota(this.app, this.ruta, desde, hacia);
  }
}
