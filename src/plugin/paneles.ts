import { MarkdownView, Notice, TFile, type App, type MarkdownPostProcessorContext, type Plugin } from 'obsidian';
import {
  abreviaturasDeNota,
  ABREVIATURAS_POR_DEFECTO,
  celdaDeTabla,
  construir,
  escribirCelda,
  escribirFecha,
  escribirTecnica,
  fechaDePareja,
  iniciosDeTabla,
  leerFecha,
  leerTecnica,
  listasDePropiedades,
  mismaNota,
  opcionesDeEscena,
  ponerAbreviatura,
  ponerValor,
  rellenoDeFila,
  tablaCoincide,
  tablaRepetida,
  tipoDeCelda,
  type Cambio,
  type ListasTecnicas,
  type TipoCelda,
} from '../motor';
import { preferencias } from './ajustes';
import { cmDe } from './editor/sugeridor';
import { correr } from './correr';
import { Calendario, Panel, PanelLista, PanelTecnica } from './paneles-ui';
import { buscarGuion, buscarProyecto, leerConfigProyecto, propiedades } from './proyecto';

/** Lo que se escribe al vaciar una celda: el guion largo de las plantillas. */
const VACIA = '—';

/** El MarkdownView que contiene el elemento. */
function vistaDe(app: App, el: HTMLElement): MarkdownView | null {
  for (const hoja of app.workspace.getLeavesOfType('markdown')) {
    const v = hoja.view;
    if (v instanceof MarkdownView && v.containerEl.contains(el)) return v;
  }
  return null;
}

/** Lo que hace falta para pedirle a Obsidian, en el momento del clic, dónde está una tabla de la vista de lectura. */
interface Origen {
  ctx: MarkdownPostProcessorContext;
  seccion: HTMLElement;
}

/** Las tablas de la vista de lectura con su contexto. Obsidian reutiliza las secciones sin volver a procesarlas, así que el renglón se pide al pulsar. */
const origenes = new WeakMap<HTMLTableElement, Origen>();

/** El renglón del encabezado de la tabla en la nota abierta, o `null` si la tabla no es de esa nota. */
function lineaDeTabla(v: MarkdownView, tabla: HTMLTableElement): number | null {
  // Las notas incrustadas (`![[…]]`) son de otra nota: no se tocan.
  if (tabla.closest('.internal-embed, .markdown-embed')) return null;
  if (v.getMode() !== 'preview') {
    // En el editor solo las tablas del propio editor, con su posición de este momento.
    const widget = tabla.closest('.cm-table-widget');
    const cm = cmDe(v.editor);
    if (!widget || !cm) return null;
    try {
      return cm.state.doc.lineAt(cm.posAtDOM(widget)).number - 1;
    } catch {
      return null;
    }
  }
  const o = origenes.get(tabla);
  if (!o || o.ctx.sourcePath !== v.file?.path) return null;
  const info = o.ctx.getSectionInfo(o.seccion);
  if (!info) return null;
  const inicios = iniciosDeTabla(info.text).filter((k) => k >= info.lineStart && k <= info.lineEnd);
  const k = Array.from(o.seccion.querySelectorAll('table')).indexOf(tabla);
  return inicios[k] ?? null;
}

/** El texto dibujado de cada celda. En la vista en vivo la celda que se edita trae además su editor: se toma solo el dibujo. */
const textos = (fila: HTMLTableRowElement) => Array.from(fila.cells).map((c) => (c.querySelector('.table-cell-wrapper') ?? c).textContent ?? '');

/** Movimientos, ángulos y lentes: los de las propiedades del proyecto (la ficha junto al guion), o los de fábrica. */
function listasDe(app: App, nota: TFile): ListasTecnicas {
  const proyecto = buscarProyecto(app, buscarGuion(app, nota.path) ?? nota);
  return listasDePropiedades(proyecto ? propiedades(app, proyecto) : {});
}

interface Destino {
  /** La nota y su texto al abrir el panel. */
  ruta: string;
  texto: string;
  linea: number;
  fila: number;
  columna: number;
  tipo: TipoCelda;
}

/**
 * Escribe solo si la nota es la misma y no cambió con el panel abierto (salvo los espacios que Obsidian alinea).
 * `calcular` recibe el texto de ese momento y devuelve los cambios, o `null` si la celda ya no es la que se pulsó.
 * En el editor va como una transacción (Ctrl+Z la deshace); en la vista de lectura, directo al archivo.
 */
async function escribir(app: App, v: MarkdownView, d: Destino, calcular: (texto: string) => Cambio[] | null): Promise<void> {
  const aviso = () => new Notice('La nota cambió mientras elegías. Vuelve a pulsar la celda.');
  const cambios = (texto: string) => {
    if (!mismaNota(texto, d.texto)) return null;
    const c = celdaDeTabla(texto, d.linea, d.fila, d.columna);
    if (!c || tipoDeCelda(c, texto, d.linea) !== d.tipo) return null;
    const cs = calcular(texto);
    return cs && cs.length ? [...cs].sort((a, b) => a.desde - b.desde) : null;
  };
  const archivo = v.file;
  if (!archivo || archivo.path !== d.ruta) return void aviso();
  if (v.getMode() === 'preview') {
    let escrito = false;
    await app.vault.process(archivo, (texto) => {
      const cs = cambios(texto);
      if (!cs) return texto;
      escrito = true;
      let t = texto;
      for (const c of [...cs].reverse()) t = t.slice(0, c.desde) + c.texto + t.slice(c.hasta);
      return t;
    });
    if (!escrito) aviso();
    return;
  }
  const editor = v.editor;
  const cs = cambios(editor.getValue());
  if (!cs) return void aviso();
  editor.transaction({ changes: cs.map((c) => ({ from: editor.offsetToPos(c.desde), to: editor.offsetToPos(c.hasta), text: c.texto })) });
}

async function alPulsar(app: App, e: MouseEvent): Promise<void> {
  // Alt+clic deja la celda como una celda normal, para escribir a mano.
  if (!preferencias.actual.calendarioFechas || e.button !== 0 || e.altKey) return;
  const blanco = e.target as HTMLElement | null;
  const td = blanco?.closest?.('td');
  const tr = td?.parentElement;
  const tabla = td?.closest('table');
  if (!td || !tr?.instanceOf(HTMLTableRowElement) || !tabla || tr.parentElement?.tagName !== 'TBODY') return;
  if (blanco?.closest('a, button, input, .table-row-drag-handle, .table-col-drag-handle')) return;
  const v = vistaDe(app, td);
  const nota = v?.file;
  if (!v || !nota || !propiedades(app, nota).carpeta) return;
  const linea = lineaDeTabla(v, tabla);
  if (linea === null || !Number.isFinite(linea)) return;
  const fila = Array.from(tr.parentElement.children).indexOf(tr);
  const columna = Array.from(tr.children).indexOf(td);
  // En la vista de lectura la nota vive en los datos de la vista; en el editor, en el editor.
  const fuente = v.getMode() === 'preview' ? v.getViewData() : v.editor.getValue();
  const celda = celdaDeTabla(fuente, linea, fila, columna);
  const tipo = celda && tipoDeCelda(celda, fuente, linea);
  if (!celda || !tipo) return;
  // La tabla dibujada, entera, tiene que ser la del texto en ese renglón: si no, no se abre nada.
  if (!tablaCoincide(fuente, linea, Array.from(tabla.rows).map(textos))) return;
  // En la vista de lectura el renglón sale de las secciones que Obsidian dibujó, que pueden ir un paso atrás del texto.
  // Con dos tablas iguales no hay forma de saber cuál se pulsó; en el editor la posición es exacta.
  if (v.getMode() === 'preview' && tablaRepetida(fuente, linea)) {
    new Notice('Esta tabla está repetida igual en la nota. Para no confundirlas, llénala en modo de edición.');
    return;
  }
  const d: Destino = { ruta: nota.path, texto: fuente, linea, fila, columna, tipo };
  /** Escribe `valor` en la celda pulsada, calculado con su texto de ese momento. */
  const poner = (valor: (texto: string) => string) =>
    correr(
      escribir(app, v, d, (t) => {
        const c = celdaDeTabla(t, linea, fila, columna);
        return c ? [escribirCelda(c, valor(c.texto))] : null;
      }),
    );
  const vacia = !celda.texto || celda.texto === VACIA;

  switch (tipo) {
    case 'fecha': {
      const pareja = fechaDePareja(fuente, linea, fila, columna);
      new Calendario(td, {
        valor: leerFecha(celda.texto),
        pareja: pareja ? { nombre: pareja.encabezado, fecha: pareja.fecha } : null,
        puedeQuitar: !vacia,
        alElegir: (f) => poner(() => (f ? escribirFecha(f) : VACIA)),
      });
      return;
    }
    case 'plano': {
      const abreviaturas = abreviaturasDeNota(fuente) ?? ABREVIATURAS_POR_DEFECTO;
      const conocidas = abreviaturas.map((a) => a.abreviatura);
      const actual = [...conocidas].sort((a, b) => b.length - a.length).find((a) => celda.texto === a || celda.texto.startsWith(a + ' ')) ?? null;
      new PanelLista(td, {
        titulo: 'Plano',
        opciones: abreviaturas.map((a) => ({ valor: a.abreviatura, detalle: a.nombre })),
        actual,
        alElegir: (op) => poner((t) => ponerAbreviatura(t, op.valor, conocidas)),
        alQuitar: vacia ? undefined : () => poner(() => VACIA),
      });
      return;
    }
    case 'movimiento':
    case 'angulo':
    case 'lente': {
      const listas = listasDe(app, nota);
      const opciones = tipo === 'movimiento' ? listas.movimientos : tipo === 'angulo' ? listas.angulos : listas.lentes;
      const titulo = tipo === 'movimiento' ? 'Movimiento' : tipo === 'angulo' ? 'Ángulo' : 'Lente';
      // Para marcar lo que ya tiene la celda se compara igual que en la descripción técnica.
      const leido = leerTecnica(celda.texto, listas);
      const actual = (tipo === 'movimiento' ? leido.movimiento : tipo === 'angulo' ? leido.angulo : leido.lente) ?? null;
      new PanelLista(td, {
        titulo,
        opciones: opciones.map((valor) => ({ valor })),
        actual,
        // Se cambia solo el valor reconocido y se conserva lo demás de la celda («paneo lento siguiendo a Ana»).
        alElegir: (op) => poner((t) => ponerValor(t, op.valor, opciones, tipo === 'lente' ? /\d+(?:[.,]\d+)?\s*mm/ : undefined)),
        alQuitar: vacia ? undefined : () => poner(() => VACIA),
      });
      return;
    }
    case 'tecnica': {
      const listas = listasDe(app, nota);
      const inicial = leerTecnica(celda.texto, listas);
      new PanelTecnica(td, listas, inicial, (t) => {
        // Sin cambios no se reescribe nada: la celda se queda como la escribió la persona.
        if (escribirTecnica(t) !== escribirTecnica(inicial)) poner(() => escribirTecnica(t));
      });
      return;
    }
    case 'escena': {
      const guion = buscarGuion(app, nota.path);
      if (!guion) {
        new Notice('Este proyecto no tiene guion: una nota con «carpeta: guion» en esta carpeta.');
        return;
      }
      const g = construir(await app.vault.cachedRead(guion), leerConfigProyecto(app, guion.path));
      // Mientras se leía el guion, la persona pudo cambiar de nota o la tabla redibujarse.
      if (!td.isConnected || app.workspace.getActiveFile()?.path !== nota.path) return;
      const escenas = opcionesDeEscena(g);
      if (!escenas.length) {
        new Notice('El guion todavía no tiene escenas.');
        return;
      }
      new PanelLista(td, {
        titulo: 'Escena',
        opciones: escenas.map((o, k) => ({ valor: o.numero, clave: String(k), etiqueta: `${o.numero}. ${o.encabezado}`, detalle: o.octavos })),
        actual: celda.texto,
        alElegir: (op) => {
          const o = escenas[Number(op.clave)];
          if (o) correr(escribir(app, v, d, (t) => rellenoDeFila(t, linea, fila, columna, o)));
        },
      });
      return;
    }
  }
}

export function registrarPaneles(plugin: Plugin): void {
  const app = plugin.app;
  // En la vista de lectura se guarda el contexto de cada tabla; el renglón se le pide a Obsidian al pulsar.
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    for (const t of Array.from(el.querySelectorAll('table'))) origenes.set(t, { ctx, seccion: el });
  });
  const escuchar = (doc: Document) =>
    plugin.registerDomEvent(doc, 'click', (e) => {
      alPulsar(app, e).catch((err: unknown) => console.error('Carpeta de producción:', err));
    });
  // La ventana principal; las ventanas aparte se agregan al abrirse (window-open).
  escuchar(document);
  plugin.registerEvent(app.workspace.on('window-open', (w) => escuchar(w.doc)));
  plugin.registerEvent(app.workspace.on('active-leaf-change', () => Panel.abierto?.cerrar()));
  plugin.registerEvent(app.workspace.on('file-open', () => Panel.abierto?.cerrar()));
  plugin.register(() => Panel.abierto?.cerrar());
}
