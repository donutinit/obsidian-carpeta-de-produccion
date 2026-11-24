import { debounce, ItemView, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import { escenaEnLinea, formatearOctavos, type ElementoBreakdown, type Guion } from '../motor';
import { abrirAgregar, marcarNoPersonaje, quitarDeEscena } from './breakdown-editable';
import { soloPresentados } from './render/breakdown';
import { copiarAOtra, marcarTodas } from './comandos-produccion';
import { oyentesCursor } from './editor/cursor';
import { construirDe } from './guion';
import { buscarGuion, notasDelProyecto } from './proyecto';
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
        const guion = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
        // El equipo especial también sale del guion técnico del proyecto.
        if (f.path === this.ruta || (guion instanceof TFile && notasDelProyecto(this.app, guion, 'guion-tecnico').some((n) => n.path === f.path))) this.pendiente();
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

    const presentadoSolo = soloPresentados(g);
    // Todas las categorías, cada una con «+» para agregar sin escribir marcas.
    for (const c of g.config.categorias) {
      const lista: ElementoBreakdown[] = c.codigo === 'rep' ? bd.reparto.map((nombre) => ({ nombre, cantidad: 1 })) : (bd.elementos[c.codigo] ?? []);
      const s = el.createDiv({ cls: 'cp-pbd-cat' });
      const cabeza = s.createDiv({ cls: 'cp-pbd-catcab' });
      cabeza.createSpan({ cls: 'cp-mark ' + claseCategoria(c.codigo, g.config.categorias), text: c.nombre });
      const mas = cabeza.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': `Agregar a ${c.nombre}` } });
      setIcon(mas, 'plus');
      const k = this.escena;
      mas.onclick = () => abrirAgregar(this.app, f, g, k, c.codigo, mas);
      if (!lista.length) continue;
      const u = s.createEl('ul');
      for (const x of lista) {
        const li = u.createEl('li');
        li.createSpan({ cls: 'cp-pbd-nombre', text: x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre });
        // En el reparto solo se quita lo marcado o lo que se presentó con edad; quien habla está por su diálogo.
        if (c.codigo === 'rep' && !(bd.elementos.rep ?? []).some((y) => y.nombre.toLowerCase() === x.nombre.toLowerCase())) {
          if (presentadoSolo(x.nombre)) {
            const b = li.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': `«${x.nombre}» no es personaje` } });
            setIcon(b, 'x');
            b.onclick = () => marcarNoPersonaje(this.app, f, x.nombre);
          }
          continue;
        }
        if (x.origen === 'tecnico') {
          const t = li.createSpan({ cls: 'cp-bd-tecnico', attr: { role: 'img', 'aria-label': 'Del guion técnico' } });
          setIcon(t, 'cog');
          t.title = 'Del guion técnico: se cambia ahí';
          continue;
        }
        const boton = (icono: string, titulo: string, fn: () => Quizas) => {
          const b = li.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': titulo } });
          setIcon(b, icono);
          b.onclick = () => correr(fn());
        };
        if (c.codigo !== 'rep')
          boton('highlighter', 'Marcar todas las menciones', () => {
            const visible = this.textoVisible(c.codigo, x.nombre) ?? x.nombre;
            void marcarTodas(this.app, f, c.codigo, visible, x.nombre);
          });
        boton('x', `Quitar «${x.nombre}» de esta escena`, () => quitarDeEscena(this.app, f, g, k, c.codigo, x.nombre));
      }
    }
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
