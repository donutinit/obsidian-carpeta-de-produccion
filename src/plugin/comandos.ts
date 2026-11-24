import { Modal, normalizePath, Notice, Setting, SuggestModal, TFile, type App, type Editor, type Plugin } from 'obsidian';
import { aplicarMarca, CATEGORIAS, proyectoMinimo, convertirParrafo, DICCIONARIOS_MX, limpiarLista, type Categoria, type Diccionarios, type TipoParrafo } from '../motor';
import { preferencias, propiedadesProyectoNuevo } from './ajustes';
import { diccionariosDe } from './editor/contexto';
import { esDocGuion } from './editor/doc';
import { AVISO_ENCIMADA } from './editor/subrayado';
import { cmDe } from './editor/sugeridor';
import { alPedirSugerencias, aplicar, deseadoDe } from './editor/teclas';
import { VISTA_NAVEGADOR } from './navegador';
import { VISTA_BREAKDOWN_ESCENA } from './panel-breakdown';
import { claseCategoria } from './render/papel';
import { buscarGuion, buscarProyecto, leerConfigProyecto } from './proyecto';
import { teclaVisible, VISTA_GUION, VistaPrevia } from './vista-previa';

export async function abrirVistaPrevia(app: App): Promise<void> {
  const ws = app.workspace;
  let hoja = ws.getLeavesOfType(VISTA_GUION)[0];
  if (!hoja) {
    const nueva = ws.getRightLeaf(false);
    if (!nueva) return;
    await nueva.setViewState({ type: VISTA_GUION, active: true });
    hoja = nueva;
  }
  await ws.revealLeaf(hoja);
}

export async function abrirNavegador(app: App): Promise<void> {
  const ws = app.workspace;
  let hoja = ws.getLeavesOfType(VISTA_NAVEGADOR)[0];
  if (!hoja) {
    const nueva = ws.getLeftLeaf(false);
    if (!nueva) return;
    await nueva.setViewState({ type: VISTA_NAVEGADOR, active: true });
    hoja = nueva;
  }
  await ws.revealLeaf(hoja);
}

export async function abrirPanelBreakdown(app: App): Promise<void> {
  const ws = app.workspace;
  let hoja = ws.getLeavesOfType(VISTA_BREAKDOWN_ESCENA)[0];
  if (!hoja) {
    const nueva = ws.getRightLeaf(false);
    if (!nueva) return;
    await nueva.setViewState({ type: VISTA_BREAKDOWN_ESCENA, active: true });
    hoja = nueva;
  }
  await ws.revealLeaf(hoja);
}

export class ModalCategoria extends SuggestModal<Categoria> {
  constructor(
    app: App,
    private alElegir: (c: Categoria) => void,
    private categorias: Categoria[] = CATEGORIAS,
  ) {
    super(app);
    this.setPlaceholder('¿Qué categoría del breakdown?');
  }
  getSuggestions(q: string) {
    const b = q.toLowerCase();
    return this.categorias.filter((c) => c.nombre.toLowerCase().includes(b) || c.codigo.startsWith(b));
  }
  renderSuggestion(c: Categoria, el: HTMLElement) {
    el.createSpan({ cls: 'cp-key', text: teclaVisible(c.tecla) });
    el.createSpan({ cls: 'cp-mark ' + claseCategoria(c.codigo, this.categorias), text: c.nombre });
    el.createSpan({ cls: 'cp-sugg-code', text: `  {${c.codigo}:…} · ${c.marca}` });
  }
  onChooseSuggestion(c: Categoria) {
    this.alElegir(c);
  }
}

export class ModalTitulo extends Modal {
  constructor(
    app: App,
    private alAceptar: (titulo: string) => void,
    private titulo = 'Nuevo proyecto',
    private etiqueta = 'Título del proyecto',
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    let valor = '';
    const aceptar = () => {
      this.close();
      this.alAceptar(valor);
    };
    new Setting(this.contentEl).setName(this.etiqueta).addText((t) => {
      t.inputEl.addClass('cp-ancho-completo');
      t.onChange((x) => (valor = x));
      t.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') aceptar();
      });
      window.setTimeout(() => t.inputEl.focus(), 30);
    });
    new Setting(this.contentEl).addButton((b) => b.setButtonText('Crear').setCta().onClick(aceptar));
  }
  onClose() {
    this.contentEl.empty();
  }
}

function subrayarConEditor(editor: Editor, codigo: string, codigos: Set<string>): void {
  const desde = editor.getCursor('from');
  const hasta = editor.getCursor('to');
  if (desde.line !== hasta.line) return;
  const r = aplicarMarca(editor.getLine(desde.line), desde.ch, hasta.ch, codigo, codigos);
  if (r.tipo === 'encimada') new Notice(AVISO_ENCIMADA);
  if (r.tipo !== 'cambio') return;
  editor.replaceRange(r.texto, { line: desde.line, ch: r.desde }, { line: desde.line, ch: r.hasta });
  editor.setCursor({ line: desde.line, ch: r.cursor });
}

async function nuevoProyecto(app: App, tituloCrudo: string): Promise<void> {
  const titulo = (tituloCrudo || '').replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
  if (!titulo) {
    new Notice('Falta el título.');
    return;
  }
  const a = app.vault.adapter;
  const origen = 'Plantillas/Proyecto nuevo';
  const destino = normalizePath(`Proyectos/${titulo}`);
  if (await a.exists(destino)) {
    new Notice(`Ya existe «${destino}».`);
    return;
  }
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const copiar = async (de: string, a2: string): Promise<void> => {
    if (!(await a.exists(a2))) await app.vault.createFolder(a2);
    const lista = await a.list(de);
    for (const f of lista.files) {
      const nombre = f.split('/').pop() ?? f;
      const meta = `${a2}/${nombre}`;
      if (/\.(md|txt|fountain|base|canvas|json)$/i.test(f)) {
        const texto = (await a.read(f)).split('{{titulo}}').join(titulo).split('{{fecha}}').join(fecha);
        await app.vault.create(meta, texto);
      } else await app.vault.createBinary(meta, await a.readBinary(f));
    }
    for (const d of lista.folders) await copiar(d, `${a2}/${d.split('/').pop()}`);
  };
  if (await a.exists(origen)) await copiar(origen, destino);
  else {
    // Sin plantillas en la vault: la ficha del proyecto y el guion, para empezar a escribir.
    if (!(await a.exists('Proyectos'))) await app.vault.createFolder('Proyectos');
    await app.vault.createFolder(destino);
    for (const [nombre, texto] of Object.entries(proyectoMinimo(titulo, fecha))) await app.vault.create(`${destino}/${nombre}`, texto);
  }
  const ficha = app.vault.getAbstractFileByPath(`${destino}/00 - Proyecto.md`);
  if (ficha instanceof TFile) {
    // Lo que cambia los resultados viaja con el proyecto: se escribe lo que la plantilla no traiga.
    await app.fileManager.processFrontMatter(ficha, (fm: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(propiedadesProyectoNuevo(preferencias.actual.nuevos))) if (fm[k] === undefined || fm[k] === null) fm[k] = v;
    });
    await app.workspace.getLeaf(true).openFile(ficha);
  }
  new Notice(`Proyecto «${titulo}» creado.`);
}

const NOMBRES_DIC: [keyof Diccionarios, string, string][] = [
  ['inicios', 'Inicios de encabezado', 'INT., EXT.…'],
  ['momentos', 'Momentos del día', 'DÍA, NOCHE…'],
  ['extensiones', 'Extensiones de personaje', 'V.O., O.S.…'],
  ['transiciones', 'Transiciones', 'CORTE A:, DISOLVENCIA A:…'],
];

/** Edita `dic_*` en las propiedades del proyecto. Una por renglón; se guardan en mayúsculas y sin repetir. */
class ModalDiccionarios extends Modal {
  constructor(
    app: App,
    private proyecto: TFile,
    private actual: Diccionarios,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Diccionarios del proyecto');
    this.contentEl.createEl('p', { text: 'Uno por renglón. Alimentan el autocompletado y el reconocimiento de transiciones y momentos. Se guardan en las propiedades de «' + this.proyecto.basename + '».' });
    const areas = new Map<keyof Diccionarios, HTMLTextAreaElement>();
    for (const [k, nombre, ejemplo] of NOMBRES_DIC) {
      new Setting(this.contentEl).setName(nombre).setDesc(ejemplo).addTextArea((t) => {
        t.setValue(this.actual[k].join('\n'));
        t.inputEl.rows = 6;
        t.inputEl.addClass('cp-dic');
        areas.set(k, t.inputEl);
      });
    }
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText('Volver a los de fábrica').onClick(async () => {
          await this.app.fileManager.processFrontMatter(this.proyecto, (fm: Record<string, unknown>) => {
            for (const [k] of NOMBRES_DIC) delete fm['dic_' + k];
          });
          this.close();
          new Notice('Diccionarios de fábrica.');
        }),
      )
      .addButton((b) =>
        b
          .setButtonText('Guardar')
          .setCta()
          .onClick(async () => {
            await this.app.fileManager.processFrontMatter(this.proyecto, (fm: Record<string, unknown>) => {
              for (const [k] of NOMBRES_DIC) fm['dic_' + k] = limpiarLista(areas.get(k)?.value ?? '');
            });
            this.close();
            new Notice('Diccionarios guardados.');
          }),
      );
  }
  onClose() {
    this.contentEl.empty();
  }
}

const TIPOS_COMANDO: [TipoParrafo, string][] = [
  ['encabezado', 'Encabezado de escena'],
  ['accion', 'Acción'],
  ['personaje', 'Personaje'],
  ['acotacion', 'Acotación'],
  ['dialogo', 'Diálogo'],
  ['transicion', 'Transición'],
  ['plano', 'Plano'],
  ['letra', 'Letra de canción'],
];

function vistaAbierta(app: App): VistaPrevia | null {
  const v = app.workspace.getLeavesOfType(VISTA_GUION)[0]?.view;
  return v instanceof VistaPrevia ? v : null;
}

export function registrarComandos(plugin: Plugin): void {
  const app = plugin.app;
  plugin.addCommand({ id: 'abrir-vista-previa', name: 'Abrir vista previa del guion', callback: () => void abrirVistaPrevia(app) });
  plugin.addCommand({ id: 'abrir-navegador', name: 'Abrir navegador de escenas', callback: () => void abrirNavegador(app) });
  plugin.addCommand({ id: 'abrir-breakdown-escena', name: 'Abrir breakdown de la escena', callback: () => void abrirPanelBreakdown(app) });
  plugin.addCommand({
    id: 'subrayar-seleccion',
    name: 'Subrayar selección',
    editorCheckCallback: (checking, editor) => {
      const desde = editor.getCursor('from');
      const hasta = editor.getCursor('to');
      if (!editor.somethingSelected() || desde.line !== hasta.line) return false;
      if (checking) return true;
      const f = app.workspace.getActiveFile();
      const cats = (f && leerConfigProyecto(app, f.path).categorias) || CATEGORIAS;
      new ModalCategoria(app, (c) => subrayarConEditor(editor, c.codigo, new Set(cats.map((x) => x.codigo))), cats).open();
      return true;
    },
  });
  TIPOS_COMANDO.forEach(([tipo, nombre], k) => {
    plugin.addCommand({
      id: 'parrafo-' + tipo,
      name: 'Párrafo: ' + nombre,
      editorCheckCallback: (checking, editor) => {
        const cm = cmDe(editor);
        if (!cm || !esDocGuion(cm.state.doc)) return false;
        if (checking) return true;
        const st = cm.state;
        const e = convertirParrafo(st.doc.toString(), st.selection.main.head, tipo, deseadoDe(st), diccionariosDe(st));
        if (!e) return true;
        aplicar(cm, e);
        if (tipo === 'personaje' || tipo === 'transicion' || tipo === 'encabezado') alPedirSugerencias.fn?.(cm);
        return true;
      },
    });
  });
  plugin.addCommand({
    id: 'editar-diccionarios',
    name: 'Editar diccionarios del proyecto',
    checkCallback: (checking) => {
      const f = app.workspace.getActiveFile();
      const guion = f ? buscarGuion(app, f.path) : null;
      if (!guion) return false;
      if (checking) return true;
      const proyecto = buscarProyecto(app, guion);
      if (!proyecto) new Notice('Este guion no tiene nota de proyecto (con «carpeta: proyecto» en sus propiedades).');
      else new ModalDiccionarios(app, proyecto, leerConfigProyecto(app, guion.path).diccionarios ?? DICCIONARIOS_MX).open();
      return true;
    },
  });
  plugin.addCommand({ id: 'nuevo-proyecto', name: 'Nuevo proyecto', callback: () => new ModalTitulo(app, (t) => void nuevoProyecto(app, t)).open() });
  for (const [id, modo, nombre] of [
    ['alternar-subrayado', 'subrayado', 'Alternar subrayado en la vista previa'],
    ['alternar-octavos', 'octavos', 'Alternar hoja de octavos en la vista previa'],
  ] as const) {
    plugin.addCommand({
      id,
      name: nombre,
      callback: () => {
        const v = vistaAbierta(app);
        if (v) v.alternar(modo);
        else new Notice('Primero abre la vista previa del guion.');
      },
    });
  }
}
