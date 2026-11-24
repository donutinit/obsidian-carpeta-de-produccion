import { Modal, Notice, Setting, SuggestModal, TFile, type App, type Editor, type Plugin } from 'obsidian';
import {
  alternarDual,
  analizar,
  bloquearNumeracion,
  CATEGORIAS,
  construir,
  copiarElementos,
  desbloquearNumeracion,
  escenaEnLinea,
  MARCA,
  marcarMenciones,
  renombrarElemento,
  type Categoria,
  type Escena,
} from '../motor';
import { aplicarCambios, textoDe } from './cambios';
import { ModalCategoria } from './comandos';
import { esDocGuion } from './editor/doc';
import { cmDe } from './editor/sugeridor';
import { asignarIds, exportarCSV, generarNotasEscena } from './generar';
import { buscarGuion, leerConfigProyecto } from './proyecto';
import { correr, type Quizas } from './correr';

/**
 * El guion del proyecto de la nota activa: ella misma, o el guion de su carpeta. Nunca uno de otra carpeta
 * (desde la raíz de la vault, `buscarGuion` podría dar el de la plantilla o el de otro proyecto).
 */
export function guionActivo(app: App): TFile | null {
  const f = app.workspace.getActiveFile();
  const g = f ? buscarGuion(app, f.path) : null;
  if (!f || !g) return null;
  const dir = g.parent && g.parent.path !== '/' ? g.parent.path + '/' : '';
  return g.path === f.path || (dir !== '' && f.path.startsWith(dir)) ? g : null;
}

const categoriasDe = (app: App, guion: TFile): Categoria[] => leerConfigProyecto(app, guion.path).categorias ?? CATEGORIAS;

class Confirmar extends Modal {
  constructor(
    app: App,
    private titulo: string,
    private texto: string,
    private boton: string,
    private alAceptar: () => Quizas,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    this.contentEl.createEl('p', { text: this.texto });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText('Cancelar').onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.boton)
          .setWarning()
          .onClick(() => {
            this.close();
            correr(this.alAceptar());
          }),
      );
  }
  onClose() {
    this.contentEl.empty();
  }
}

export class ModalEscena extends SuggestModal<Escena> {
  constructor(
    app: App,
    private escenas: Escena[],
    private alElegir: (e: Escena) => Quizas,
    lugar = '¿A qué escena?',
  ) {
    super(app);
    this.setPlaceholder(lugar);
  }
  getSuggestions(q: string) {
    const b = q.toLowerCase();
    return this.escenas.filter((e) => `${e.numero} ${e.encabezado}`.toLowerCase().includes(b));
  }
  renderSuggestion(e: Escena, el: HTMLElement) {
    el.createSpan({ cls: 'cp-sugg-num', text: e.numero + '  ' });
    el.createSpan({ text: e.encabezado });
  }
  onChooseSuggestion(e: Escena) {
    correr(this.alElegir(e));
  }
}

interface ElementoElegible {
  codigo: string;
  nombre: string;
}

class ModalElemento extends SuggestModal<ElementoElegible> {
  constructor(
    app: App,
    private elementos: ElementoElegible[],
    private categorias: Categoria[],
    private alElegir: (e: ElementoElegible) => Quizas,
  ) {
    super(app);
    this.setPlaceholder('¿Qué elemento renombras o fusionas?');
  }
  getSuggestions(q: string) {
    const b = q.toLowerCase();
    return this.elementos.filter((e) => e.nombre.toLowerCase().includes(b) || e.codigo.startsWith(b));
  }
  renderSuggestion(e: ElementoElegible, el: HTMLElement) {
    el.createSpan({ text: e.nombre });
    el.createSpan({ cls: 'cp-sugg-code', text: '  · ' + (this.categorias.find((c) => c.codigo === e.codigo)?.nombre ?? e.codigo) });
  }
  onChooseSuggestion(e: ElementoElegible) {
    correr(this.alElegir(e));
  }
}

class ModalNombre extends Modal {
  constructor(
    app: App,
    private elemento: ElementoElegible,
    private existentes: string[],
    private alAceptar: (nuevo: string) => Quizas,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText(`Renombrar «${this.elemento.nombre}»`);
    this.contentEl.createEl('p', { text: 'Cambia el nombre en todas sus marcas del guion. Si escribes el nombre de otro elemento de la misma categoría, los dos quedan fusionados.' });
    let valor = this.elemento.nombre;
    const aceptar = () => {
      this.close();
      if (valor.trim() && valor.trim() !== this.elemento.nombre) correr(this.alAceptar(valor.trim()));
    };
    new Setting(this.contentEl).setName('Nombre nuevo').addText((t) => {
      t.setValue(valor).onChange((x) => (valor = x));
      const lista = this.contentEl.createEl('datalist', { attr: { id: 'cp-nombres' } });
      this.existentes.forEach((n) => lista.createEl('option', { attr: { value: n } }));
      t.inputEl.setAttr('list', 'cp-nombres');
      t.inputEl.addClass('cp-ancho-completo');
      t.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') aceptar();
      });
      window.setTimeout(() => t.inputEl.select(), 30);
    });
    new Setting(this.contentEl).addButton((b) => b.setButtonText('Renombrar').setCta().onClick(aceptar));
  }
  onClose() {
    this.contentEl.empty();
  }
}

/** La marca bajo el cursor: código, texto visible y nombre. */
function marcaEnCursor(editor: Editor): { cat: string; texto: string; nombre: string } | null {
  const c = editor.getCursor();
  for (const m of editor.getLine(c.line).matchAll(new RegExp(MARCA.source, 'g'))) {
    const a = m.index ?? 0;
    if (a <= c.ch && c.ch <= a + m[0].length) return { cat: m[1], texto: m[2], nombre: (m[3] ?? m[2]).trim() };
  }
  return null;
}

export async function marcarTodas(app: App, guion: TFile, cat: string, texto: string, nombre?: string): Promise<void> {
  const n = await aplicarCambios(app, guion, (t) => marcarMenciones(t, cat, texto, nombre));
  new Notice(n ? `${n} ${n === 1 ? 'mención marcada' : 'menciones marcadas'}.` : 'No encontré más menciones sin marcar.');
}

export function copiarAOtra(app: App, guion: TFile, desde: number): void {
  void textoDe(app, guion).then((t) => {
    const escenas = analizar(t).escenas.filter((e) => e.indice !== desde);
    new ModalEscena(app, escenas, async (e) => {
      const n = await aplicarCambios(app, guion, (x) => copiarElementos(x, desde, e.indice));
      new Notice(n ? `Elementos copiados a la escena ${e.numero}.` : `La escena ${e.numero} ya tenía todos esos elementos.`);
    }).open();
  });
}

export function registrarComandosProduccion(plugin: Plugin): void {
  const app = plugin.app;
  const conGuion = (id: string, name: string, fn: (g: TFile) => Quizas) =>
    plugin.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const g = guionActivo(app);
        if (!g) return false;
        if (!checking) correr(fn(g));
        return true;
      },
    });

  conGuion('bloquear-numeracion', 'Bloquear numeración de escenas', (g) =>
    new Confirmar(app, 'Bloquear numeración', 'Cada encabezado recibe su número fijo (#5#). Las escenas que agregues después tomarán letra (5A, 5B…). Se puede deshacer con Ctrl+Z en la pestaña del guion.', 'Bloquear', async () => {
      const n = await aplicarCambios(app, g, bloquearNumeracion);
      new Notice(n ? `Numeración bloqueada: ${n} ${n === 1 ? 'escena' : 'escenas'} con número fijo.` : 'La numeración ya estaba bloqueada.');
    }).open(),
  );
  conGuion('desbloquear-numeracion', 'Desbloquear numeración de escenas', (g) =>
    new Confirmar(app, 'Desbloquear numeración', 'Se quitan los números fijos (#5A#) de todos los encabezados y las escenas se vuelven a numerar desde 1. Se puede deshacer con Ctrl+Z en la pestaña del guion.', 'Desbloquear', async () => {
      const n = await aplicarCambios(app, g, desbloquearNumeracion);
      new Notice(n ? 'Numeración desbloqueada.' : 'No había números fijos.');
    }).open(),
  );
  conGuion('asignar-ids', 'Asignar identificadores a las escenas', async (g) => {
    const n = await asignarIds(app, g);
    new Notice(n ? `${n} ${n === 1 ? 'escena recibió' : 'escenas recibieron'} identificador.` : 'Todas las escenas ya tenían identificador.');
  });
  conGuion('generar-notas-escena', 'Generar notas por escena (para Bases)', (g) => void generarNotasEscena(app, g));
  conGuion('exportar-csv', 'Exportar breakdown a CSV', (g) => void exportarCSV(app, g));
  conGuion('renombrar-elemento', 'Renombrar o fusionar elemento del breakdown', async (g) => {
    const t = await textoDe(app, g);
    const gu = construir(t, leerConfigProyecto(app, g.path));
    const vistos: ElementoElegible[] = [];
    for (const b of gu.breakdown) for (const [codigo, lista] of Object.entries(b.elementos)) for (const x of lista) if (!vistos.some((v) => v.codigo === codigo && v.nombre === x.nombre)) vistos.push({ codigo, nombre: x.nombre });
    const cats = categoriasDe(app, g);
    new ModalElemento(app, vistos, cats, (el) => {
      const mismos = vistos.filter((v) => v.codigo === el.codigo && v.nombre !== el.nombre).map((v) => v.nombre);
      new ModalNombre(app, el, mismos, async (nuevo) => {
        const n = await aplicarCambios(app, g, (x) => renombrarElemento(x, el.codigo, el.nombre, nuevo));
        new Notice(`«${el.nombre}» → «${nuevo}» en ${n} ${n === 1 ? 'marca' : 'marcas'}.`);
      }).open();
    }).open();
  });

  plugin.addCommand({
    id: 'dialogo-dual',
    name: 'Diálogo dual (poner o quitar ^)',
    editorCheckCallback: (checking, editor) => {
      const cm = cmDe(editor);
      if (!cm || !esDocGuion(cm.state.doc)) return false;
      if (checking) return true;
      const c = alternarDual(editor.getValue(), editor.posToOffset(editor.getCursor()));
      if (!c) new Notice('Pon el cursor en uno de dos diálogos seguidos.');
      else editor.transaction({ changes: [{ from: editor.offsetToPos(c.desde), to: editor.offsetToPos(c.hasta), text: c.texto }] });
      return true;
    },
  });
  plugin.addCommand({
    id: 'marcar-menciones',
    name: 'Marcar todas las menciones',
    editorCheckCallback: (checking, editor, ctx) => {
      const cm = cmDe(editor);
      const g = ctx.file ? buscarGuion(app, ctx.file.path) : null;
      if (!cm || !esDocGuion(cm.state.doc) || !g) return false;
      const marca = marcaEnCursor(editor);
      const sel = editor.getSelection();
      if (!marca && (!sel.trim() || sel.includes('\n'))) return false;
      if (checking) return true;
      if (marca) void marcarTodas(app, g, marca.cat, marca.texto || marca.nombre, marca.nombre);
      else {
        const cats = categoriasDe(app, g);
        new ModalCategoria(app, (c) => void marcarTodas(app, g, c.codigo, sel.trim()), cats).open();
      }
      return true;
    },
  });
  plugin.addCommand({
    id: 'copiar-elementos',
    name: 'Copiar los elementos de esta escena a otra',
    editorCheckCallback: (checking, editor, ctx) => {
      const cm = cmDe(editor);
      const g = ctx.file ? buscarGuion(app, ctx.file.path) : null;
      if (!cm || !esDocGuion(cm.state.doc) || !g) return false;
      const k = escenaEnLinea(analizar(editor.getValue()).escenas, editor.getCursor().line);
      if (k < 0) return false;
      if (!checking) copiarAOtra(app, g, k);
      return true;
    },
  });
}
