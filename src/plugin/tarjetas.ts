import { debounce, ItemView, MarkdownView, TFile, type App, type WorkspaceLeaf } from 'obsidian';
import { duracionEscenas, formatearDuracion, formatearOctavos } from '../motor';
import { construirDe } from './guion';
import { MIME_ESCENA, moverEscenaEnNota, pintarColor, resumen } from './mover';
import { buscarGuion } from './proyecto';

export const VISTA_TARJETAS = 'carpeta-tarjetas';

/** Vista de tarjetas (corcho): una tarjeta por escena; clic va a la escena y arrastrar reordena el guion. */
export class VistaTarjetas extends ItemView {
  ruta: string | null = null;
  private pendiente = debounce((texto?: string) => void this.render(texto), 300, true);

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  getViewType() {
    return VISTA_TARJETAS;
  }
  getDisplayText() {
    return 'Tarjetas de escenas';
  }
  getIcon() {
    return 'layout-grid';
  }

  async onOpen() {
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.seguirActiva()));
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, info) => {
        if (info?.file?.path === this.ruta) this.pendiente(editor.getValue());
      }),
    );
    this.registerEvent(
      this.app.vault.on('modify', (f) => {
        if (f.path === this.ruta) this.pendiente();
      }),
    );
    this.seguirActiva(true);
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
    const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    const g = f instanceof TFile ? await construirDe(this.app, f, texto) : null;
    const el = this.contentEl;
    const arriba = el.scrollTop;
    el.empty();
    el.addClass('cp-tarjetas');
    if (!g) {
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion para ver sus escenas como tarjetas.' });
      return;
    }
    const dur = duracionEscenas(g);
    const rejilla = el.createDiv({ cls: 'cp-tj-rejilla' });
    g.doc.escenas.forEach((e, k) => {
      const t = rejilla.createDiv({ cls: 'cp-tj', attr: { draggable: 'true' } });
      pintarColor(t.createDiv({ cls: 'cp-tj-color' }), e.meta.color);
      const cab = t.createDiv({ cls: 'cp-tj-cab' });
      cab.createSpan({ cls: 'cp-tj-num', text: e.numero });
      cab.createSpan({ cls: 'cp-tj-dur', text: `${formatearOctavos(g.octavos.porEscena[k] ?? 0)} · ${formatearDuracion(dur[k] ?? 0)}` });
      t.createDiv({ cls: 'cp-tj-enc', text: e.meta.titulo || e.encabezado });
      if (e.meta.titulo) t.createDiv({ cls: 'cp-tj-sub', text: e.encabezado });
      const r = resumen(g, k, 160);
      if (r) t.createDiv({ cls: 'cp-tj-res', text: r });
      if (g.breakdown[k].reparto.length) t.createDiv({ cls: 'cp-tj-rep', text: g.breakdown[k].reparto.join(' · ') });
      t.onclick = () => this.ir(e.linea);
      t.addEventListener('dragstart', (ev) => {
        ev.dataTransfer?.setData(MIME_ESCENA, JSON.stringify({ ruta: this.ruta, k, encabezado: e.encabezado }));
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
        t.addClass('is-arrastrada');
      });
      t.addEventListener('dragend', () => {
        t.removeClass('is-arrastrada');
        rejilla.querySelectorAll('.cp-tj-sobre').forEach((x) => x.removeClass('cp-tj-sobre'));
      });
      t.addEventListener('dragover', (ev) => {
        if (!ev.dataTransfer?.types.includes(MIME_ESCENA)) return;
        ev.preventDefault();
        rejilla.querySelectorAll('.cp-tj-sobre').forEach((x) => x.removeClass('cp-tj-sobre'));
        t.addClass('cp-tj-sobre');
      });
      t.addEventListener('drop', (ev) => {
        const datos = ev.dataTransfer?.getData(MIME_ESCENA);
        if (!datos || !this.ruta) return;
        ev.preventDefault();
        const d = JSON.parse(datos) as { ruta: string; k: number; encabezado: string };
        if (d.ruta === this.ruta && d.k !== k) void moverEscenaEnNota(this.app, this.ruta, { k: d.k, encabezado: d.encabezado }, { k, encabezado: e.encabezado });
      });
    });
    if (!g.doc.escenas.length) rejilla.createDiv({ cls: 'cp-msg', text: 'No hay escenas todavía.' });
    el.scrollTop = arriba;
  }

  private ir(linea: number) {
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ruta);
    if (!hoja || !(hoja.view instanceof MarkdownView)) {
      const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
      if (f instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(f, { eState: { line: linea } });
      return;
    }
    this.app.workspace.setActiveLeaf(hoja, { focus: true });
    hoja.view.editor.setCursor({ line: linea, ch: 0 });
    hoja.view.editor.scrollIntoView({ from: { line: linea, ch: 0 }, to: { line: linea, ch: 0 } }, true);
  }
}

export async function abrirTarjetas(app: App): Promise<void> {
  let hoja = app.workspace.getLeavesOfType(VISTA_TARJETAS)[0];
  if (!hoja) {
    hoja = app.workspace.getLeaf('tab');
    await hoja.setViewState({ type: VISTA_TARJETAS, active: true });
  }
  await app.workspace.revealLeaf(hoja);
}
