import { debounce, ItemView, MarkdownView, TFile, type App, type Plugin, type WorkspaceLeaf } from 'obsidian';
import { analizar, DICCIONARIOS_MX, revisarGuion, type Observacion } from '../motor';
import { textoDe } from './cambios';
import { buscarGuion, leerConfigProyecto } from './proyecto';

export const VISTA_REVISION = 'carpeta-revision';

/** Panel con las observaciones del revisor para el guion de la nota activa. Un clic lleva a la línea. */
export class PanelRevision extends ItemView {
  ruta: string | null = null;
  private pendiente = debounce(() => void this.render(), 500, true);

  async onClose() {
    this.pendiente.cancel();
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VISTA_REVISION;
  }

  getDisplayText() {
    return 'Revisión del guion';
  }

  getIcon() {
    return 'spell-check';
  }

  async onOpen() {
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.seguirActiva()));
    this.registerEvent(
      this.app.workspace.on('editor-change', (_e, info) => {
        if (info?.file?.path === this.ruta) this.pendiente();
      }),
    );
    this.registerEvent(
      this.app.vault.on('modify', (f) => {
        if (f.path === this.ruta) this.pendiente();
      }),
    );
    this.seguirActiva(true);
  }

  private seguirActiva(forzar = false) {
    const f = this.app.workspace.getActiveFile();
    const g = f && f.extension === 'md' ? buscarGuion(this.app, f.path) : null;
    if (g && (forzar || g.path !== this.ruta)) {
      this.ruta = g.path;
      void this.render();
    } else if (forzar && !this.ruta) void this.render();
  }

  private archivo(): TFile | null {
    const f = this.ruta ? this.app.vault.getAbstractFileByPath(this.ruta) : null;
    return f instanceof TFile ? f : null;
  }

  async render() {
    const el = this.contentEl;
    const f = this.archivo();
    const texto = f ? await textoDe(this.app, f) : '';
    // Se redibuja mientras se escribe: el desplazamiento del panel se conserva.
    const arriba = el.scrollTop;
    el.empty();
    el.addClass('cp-panel-rev');
    if (!f) {
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion para revisarla.' });
      return;
    }
    const dic = leerConfigProyecto(this.app, f.path).diccionarios ?? DICCIONARIOS_MX;
    const opciones = { transiciones: dic.transiciones, momentos: dic.momentos };
    const obs = revisarGuion(texto, opciones);
    el.createDiv({ cls: 'cp-rev-cuenta', text: obs.length ? `${obs.length} ${obs.length === 1 ? 'observación' : 'observaciones'} en «${f.basename}»` : `Sin observaciones en «${f.basename}».` });
    if (!obs.length) return;
    const escenas = analizar(texto, opciones).escenas;
    const grupos = new Map<number, Observacion[]>();
    for (const o of obs) grupos.set(o.escena, [...(grupos.get(o.escena) ?? []), o]);
    for (const [k, lista] of grupos) {
      const s = escenas[k];
      el.createDiv({ cls: 'cp-rev-escena', text: s ? `${s.numero}. ${s.encabezado}` : 'Antes de la primera escena' });
      for (const o of lista) {
        const b = el.createEl('button', { cls: 'cp-rev-obs', attr: { type: 'button', 'aria-label': `${o.nombre}: ir a la línea` } });
        b.createDiv({ cls: 'cp-rev-regla', text: o.nombre });
        b.createDiv({ cls: 'cp-rev-frag', text: o.fragmento });
        b.createDiv({ cls: 'cp-rev-msg', text: o.mensaje });
        b.addEventListener('click', () => this.ir(o.linea));
      }
    }
    el.scrollTop = arriba;
  }

  private ir(linea: number) {
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ruta);
    if (!hoja || !(hoja.view instanceof MarkdownView)) {
      const f = this.archivo();
      if (f) void this.app.workspace.getLeaf('tab').openFile(f, { eState: { line: linea } });
      return;
    }
    this.app.workspace.setActiveLeaf(hoja, { focus: true });
    const ed = hoja.view.editor;
    const pos = { line: Math.min(linea, ed.lineCount() - 1), ch: 0 };
    ed.setCursor(pos);
    ed.scrollIntoView({ from: pos, to: pos }, true);
  }
}

export async function abrirRevision(app: App): Promise<void> {
  let hoja = app.workspace.getLeavesOfType(VISTA_REVISION)[0];
  if (!hoja) {
    const nueva = app.workspace.getRightLeaf(false);
    if (!nueva) return;
    await nueva.setViewState({ type: VISTA_REVISION, active: true });
    hoja = nueva;
  }
  await app.workspace.revealLeaf(hoja);
}

export function registrarRevisionGuion(plugin: Plugin): void {
  const app = plugin.app;
  plugin.registerView(VISTA_REVISION, (leaf) => new PanelRevision(leaf));
  plugin.addCommand({ id: 'abrir-revision', name: 'Revisar el guion', callback: () => void abrirRevision(app) });
}
