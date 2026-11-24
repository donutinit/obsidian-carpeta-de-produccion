import { debounce, ItemView, Notice, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import { escenaEnLinea, formatearOctavos, quitarElemento, type Guion } from '../motor';
import { aplicarCambios } from './cambios';
import { copiarAOtra, marcarTodas } from './comandos-produccion';
import { oyentesCursor } from './editor/cursor';
import { construirDe } from './guion';
import { buscarGuion } from './proyecto';
import { claseCategoria } from './render/papel';
import { correr, type Quizas } from './correr';

export const VISTA_BREAKDOWN_ESCENA = 'carpeta-breakdown-escena';

/** Panel del breakdown de la escena del cursor: sus elementos por categoría, con acciones. */
export class PanelBreakdown extends ItemView {
  ruta: string | null = null;
  private g: Guion | null = null;
  private escena = 0;
  private pendiente = debounce((texto?: string) => void this.render(texto), 300, true);
  private alCursor = (ruta: string, linea: number) => {
    if (ruta !== this.ruta || !this.g) return;
    const k = Math.max(0, escenaEnLinea(this.g.doc.escenas, linea));
    if (k !== this.escena) {
      this.escena = k;
      this.dibujar();
    }
  };

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  getViewType() {
    return VISTA_BREAKDOWN_ESCENA;
  }
  getDisplayText() {
    return 'Breakdown de la escena';
  }
  getIcon() {
    return 'clipboard-list';
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
        if (f.path === this.app.workspace.getActiveFile()?.path) this.seguirActiva();
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
      this.escena = 0;
      void this.render();
    } else if (forzar && !this.ruta) void this.render();
  }

  async render(texto?: string) {
    const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    this.g = f instanceof TFile ? await construirDe(this.app, f, texto) : null;
    this.dibujar();
  }

  private dibujar() {
    const el = this.contentEl;
    el.empty();
    el.addClass('cp-panel-bd');
    const g = this.g;
    const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    if (!g || !(f instanceof TFile)) {
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion para ver el breakdown de cada escena.' });
      return;
    }
    const e = g.doc.escenas[this.escena];
    if (!e) {
      el.createDiv({ cls: 'cp-msg', text: 'No hay escenas todavía.' });
      return;
    }
    const bd = g.breakdown[this.escena];
    const cab = el.createDiv({ cls: 'cp-pbd-cab' });
    cab.createDiv({ cls: 'cp-pbd-num', text: `Escena ${e.numero} · ${formatearOctavos(g.octavos.porEscena[this.escena] ?? 0)}` });
    cab.createDiv({ cls: 'cp-pbd-enc', text: e.encabezado });
    const acciones = el.createDiv({ cls: 'cp-pbd-acciones' });
    const copiar = acciones.createEl('button', { text: 'Copiar elementos a otra escena' });
    copiar.onclick = () => copiarAOtra(this.app, f, this.escena);

    const sec = el.createDiv({ cls: 'cp-pbd-cat' });
    sec.createSpan({ cls: 'cp-mark ' + claseCategoria('rep', g.config.categorias), text: 'Reparto' });
    const ul = sec.createEl('ul');
    if (!bd.reparto.length) ul.createEl('li', { cls: 'cp-empty', text: '—' });
    bd.reparto.forEach((n) => ul.createEl('li', { text: n }));

    let alguno = false;
    for (const c of g.config.categorias) {
      const lista = bd.elementos[c.codigo];
      if (c.codigo === 'rep' || !lista?.length) continue;
      alguno = true;
      const s = el.createDiv({ cls: 'cp-pbd-cat' });
      s.createSpan({ cls: 'cp-mark ' + claseCategoria(c.codigo, g.config.categorias), text: c.nombre });
      const u = s.createEl('ul');
      for (const x of lista) {
        const li = u.createEl('li');
        li.createSpan({ cls: 'cp-pbd-nombre', text: x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre });
        const boton = (icono: string, titulo: string, fn: () => Quizas) => {
          const b = li.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': titulo } });
          setIcon(b, icono);
          b.onclick = () => correr(fn());
        };
        boton('highlighter', 'Marcar todas las menciones', () => {
          const visible = this.textoVisible(c.codigo, x.nombre) ?? x.nombre;
          void marcarTodas(this.app, f, c.codigo, visible, x.nombre);
        });
        boton('x', 'Quitar de esta escena', async () => {
          const n = await aplicarCambios(this.app, f, (t) => quitarElemento(t, this.escena, c.codigo, x.nombre));
          new Notice(n ? `«${x.nombre}» ya no está en la escena ${e.numero}.` : 'No encontré sus marcas.');
        });
      }
    }
    if (!alguno) el.createDiv({ cls: 'cp-msg', text: 'Esta escena no tiene elementos marcados. Selecciona texto y pulsa el número de su categoría.' });
  }

  /** El texto visible de la primera marca de ese elemento en la escena (para buscar sus menciones). */
  private textoVisible(cat: string, nombre: string): string | null {
    for (const b of this.g?.bloques ?? []) {
      if (b.escena !== this.escena) continue;
      for (const l of b.lineas) for (const s of [...l.segs, ...(l.der?.segs ?? [])]) if (s.cat === cat && s.t && s.item?.toLowerCase() === nombre.toLowerCase()) return s.t;
    }
    return null;
  }
}
