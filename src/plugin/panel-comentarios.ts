import { debounce, ItemView, MarkdownView, Modal, Notice, Setting, setIcon, TFile, type App, type Editor, type Plugin, type WorkspaceLeaf } from 'obsidian';
import { agregarComentario, alternarResuelto, borrarComentario, listarComentarios, responderComentario, type Cambio, type Comentario } from '../motor';
import { preferencias } from './ajustes';
import { aplicarCambios, textoDe } from './cambios';
import { esDocGuion } from './editor/doc';
import { cmDe } from './editor/sugeridor';
import { buscarGuion } from './proyecto';

export const VISTA_COMENTARIOS = 'carpeta-comentarios';

const autor = () => preferencias.actual.autorComentarios || 'Comentario';

/** Un modal con un área de texto; Ctrl+Enter acepta. */
export class ModalTexto extends Modal {
  constructor(
    app: App,
    private titulo: string,
    private contexto: string,
    private alAceptar: (texto: string) => void,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    if (this.contexto) this.contentEl.createEl('p', { cls: 'cp-msg', text: this.contexto });
    let valor = '';
    const aceptar = () => {
      if (!valor.trim()) return;
      this.close();
      this.alAceptar(valor);
    };
    new Setting(this.contentEl).addTextArea((t) => {
      t.inputEl.rows = 4;
      t.inputEl.addClass('cp-ancho-completo');
      t.onChange((x) => (valor = x));
      t.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) aceptar();
      });
      window.setTimeout(() => t.inputEl.focus(), 30);
    });
    new Setting(this.contentEl).setDesc(`Firma: ${autor()} (se cambia en los ajustes). Ctrl+Enter guarda.`).addButton((b) => b.setButtonText('Guardar').setCta().onClick(aceptar));
  }
  onClose() {
    this.contentEl.empty();
  }
}

/** «Comentar selección»: el comentario va justo después de lo seleccionado (o del cursor). */
export function comentarEnEditor(app: App, editor: Editor): void {
  const desde = editor.getCursor('from');
  const to = editor.getCursor('to');
  // Un triple clic selecciona hasta el inicio de la línea siguiente: el comentario va al final de la seleccionada.
  const fin = to.ch === 0 && to.line > desde.line ? { line: to.line - 1, ch: editor.getLine(to.line - 1).length } : to;
  const hasta = editor.posToOffset(fin);
  const fragmento = editor.getSelection().trim();
  if (!agregarComentario(editor.getValue(), hasta, autor(), 'x')) {
    new Notice('Aquí no se puede comentar (son las propiedades de la nota).');
    return;
  }
  new ModalTexto(app, 'Comentar', fragmento ? `«${fragmento.slice(0, 120)}»` : '', (texto) => {
    const c = agregarComentario(editor.getValue(), hasta, autor(), texto);
    if (c) editor.transaction({ changes: [{ from: editor.offsetToPos(c.desde), to: editor.offsetToPos(c.hasta), text: c.texto }] });
  }).open();
}

/** Vuelve a encontrar el comentario en el texto vigente (por posición y contenido) antes de cambiarlo. */
function enTextoVigente(texto: string, c: Comentario): Comentario | null {
  return listarComentarios(texto).find((x) => x.desde === c.desde && x.hasta === c.hasta && x.autor === c.autor && x.texto === c.texto) ?? null;
}

/** Panel de comentarios del guion de la nota activa: ir, responder, resolver y borrar. */
export class PanelComentarios extends ItemView {
  ruta: string | null = null;
  verResueltos = false;
  private pendiente = debounce(() => void this.render(), 300, true);

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  getViewType() {
    return VISTA_COMENTARIOS;
  }
  getDisplayText() {
    return 'Comentarios del guion';
  }
  getIcon() {
    return 'message-square';
  }

  async onOpen() {
    this.addAction('check-check', 'Mostrar u ocultar resueltos', () => {
      this.verResueltos = !this.verResueltos;
      void this.render();
    });
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

  seguirActiva(forzar = false) {
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
    el.empty();
    el.addClass('cp-panel-com');
    if (!f) {
      el.createDiv({ cls: 'cp-msg', text: 'Abre una nota de guion para ver sus comentarios.' });
      return;
    }
    const todos = listarComentarios(texto);
    const visibles = todos.filter((c) => this.verResueltos || !c.resuelto);
    const resueltos = todos.filter((c) => c.resuelto).length;
    el.createDiv({ cls: 'cp-pcom-pie', text: `${todos.length - resueltos} abiertos · ${resueltos} resueltos${this.verResueltos ? '' : ' (ocultos)'}` });
    if (!visibles.length) el.createDiv({ cls: 'cp-msg', text: todos.length ? 'No hay comentarios abiertos.' : 'Este guion no tiene comentarios. Selecciona texto y usa «Comentar selección».' });
    for (const c of visibles) {
      const tarjeta = el.createDiv({ cls: 'cp-pcom' + (c.resuelto ? ' is-resuelto' : '') });
      tarjeta.createDiv({ cls: 'cp-pcom-frag', text: c.fragmento ? `«${c.fragmento.slice(0, 90)}${c.fragmento.length > 90 ? '…' : ''}»` : `Línea ${c.linea + 1}` });
      const p = tarjeta.createDiv({ cls: 'cp-pcom-texto' });
      p.createSpan({ cls: 'cp-pcom-autor', text: c.autor + ': ' });
      p.createSpan({ text: c.texto });
      for (const r of c.respuestas) {
        const q = tarjeta.createDiv({ cls: 'cp-pcom-resp' });
        q.createSpan({ cls: 'cp-pcom-autor', text: r.autor + ': ' });
        q.createSpan({ text: r.texto });
      }
      const acciones = tarjeta.createDiv({ cls: 'cp-pcom-acciones' });
      const boton = (icono: string, titulo: string, fn: () => void) => {
        const b = acciones.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': titulo } });
        setIcon(b, icono);
        b.onclick = fn;
      };
      boton('arrow-right', 'Ir al comentario', () => this.ir(c));
      boton('reply', 'Responder', () => new ModalTexto(this.app, 'Responder', `${c.autor}: ${c.texto}`, (t) => void this.cambiar(c, (_x, v) => responderComentario(v, autor(), t))).open());
      boton(c.resuelto ? 'rotate-ccw' : 'check', c.resuelto ? 'Reabrir' : 'Resolver', () => void this.cambiar(c, (t, v) => alternarResuelto(t, v)));
      boton('trash-2', 'Borrar', () => void this.cambiar(c, (t, v) => borrarComentario(t, v)));
    }
  }

  private async cambiar(c: Comentario, hacer: (texto: string, vigente: Comentario) => Cambio) {
    const f = this.archivo();
    if (!f) return;
    let perdido = false;
    await aplicarCambios(this.app, f, (t) => {
      const vigente = enTextoVigente(t, c);
      if (!vigente) {
        perdido = true;
        return [];
      }
      return [hacer(t, vigente)];
    });
    if (perdido) new Notice('El comentario cambió de lugar; vuelve a intentarlo.');
    void this.render();
  }

  private ir(c: Comentario) {
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ruta);
    if (!hoja || !(hoja.view instanceof MarkdownView)) {
      const f = this.archivo();
      if (f) void this.app.workspace.getLeaf('tab').openFile(f, { eState: { line: c.linea } });
      return;
    }
    this.app.workspace.setActiveLeaf(hoja, { focus: true });
    const ed = hoja.view.editor;
    ed.setSelection(ed.offsetToPos(c.desde), ed.offsetToPos(c.hasta));
    ed.scrollIntoView({ from: ed.offsetToPos(c.desde), to: ed.offsetToPos(c.hasta) }, true);
  }
}

export async function abrirComentarios(app: App): Promise<void> {
  let hoja = app.workspace.getLeavesOfType(VISTA_COMENTARIOS)[0];
  if (!hoja) {
    const nueva = app.workspace.getRightLeaf(false);
    if (!nueva) return;
    await nueva.setViewState({ type: VISTA_COMENTARIOS, active: true });
    hoja = nueva;
  }
  await app.workspace.revealLeaf(hoja);
}

export function registrarComentarios(plugin: Plugin): void {
  const app = plugin.app;
  plugin.registerView(VISTA_COMENTARIOS, (leaf) => new PanelComentarios(leaf));
  plugin.addCommand({ id: 'abrir-comentarios', name: 'Abrir comentarios del guion', callback: () => void abrirComentarios(app) });
  plugin.addCommand({
    id: 'comentar-seleccion',
    name: 'Comentar selección',
    editorCheckCallback: (checking, editor) => {
      const cm = cmDe(editor);
      if (!cm || !esDocGuion(cm.state.doc)) return false;
      if (!checking) comentarEnEditor(app, editor);
      return true;
    },
  });
}
