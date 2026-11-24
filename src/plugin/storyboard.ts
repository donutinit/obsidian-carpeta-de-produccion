import { normalizePath, Notice, TFile, TFolder, type App, type Plugin } from 'obsidian';
import {
  abreviaturasDeNota,
  ABREVIATURAS_POR_DEFECTO,
  armarStoryboard,
  cambiarVineta,
  insertarDibujo,
  mismaNota,
  ponerAbreviatura,
  vinetasDeTecnico,
  type Cambio,
  type CampoVineta,
  type ListasTecnicas,
  type Vineta,
} from '../motor';
import { aplicarCambios, vistaDe } from './cambios';
import { correr } from './correr';
import { PanelLista, PanelTexto } from './paneles-ui';
import { buscarGuion, listasDelProyecto, notasDelProyecto, propiedades } from './proyecto';

const carpetaDe = (ruta: string) => (ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '');

/** Una viñeta con el guion técnico donde vive y el texto de ese momento. */
export interface VinetaEn {
  vineta: Vineta;
  tecnico: TFile;
  texto: string;
}

/** Las viñetas de cada guion técnico, mientras su texto no cambie: con muchas viñetas, el guion técnico se lee una vez. */
const leidas = new Map<string, { texto: string; listas: ListasTecnicas; vinetas: Vineta[] }>();

/** El texto vigente: el del editor si está abierto para editar (puede no estar guardado), o el del archivo. */
async function textoVigente(app: App, f: TFile): Promise<string> {
  const v = vistaDe(app, f.path);
  return v && v.getMode() === 'source' ? v.editor.getValue() : app.vault.cachedRead(f);
}

/** Las viñetas de todos los guiones técnicos del proyecto de la nota, con el texto vigente de cada uno. */
export async function vinetasDelProyecto(app: App, nota: TFile): Promise<{ vinetas: VinetaEn[]; listas: ListasTecnicas } | null> {
  const guion = buscarGuion(app, nota.path);
  if (!guion) return null;
  const listas = listasDelProyecto(app, guion);
  const vinetas: VinetaEn[] = [];
  for (const tecnico of notasDelProyecto(app, guion, 'guion-tecnico')) {
    const texto = await textoVigente(app, tecnico);
    const previa = leidas.get(tecnico.path);
    const lista = previa && previa.texto === texto && previa.listas === listas ? previa.vinetas : vinetasDeTecnico(texto, listas);
    if (lista !== previa?.vinetas) leidas.set(tecnico.path, { texto, listas, vinetas: lista });
    for (const vineta of lista) if (!vinetas.some((x) => x.vineta.id === vineta.id)) vinetas.push({ vineta, tecnico, texto });
  }
  return { vinetas, listas };
}

/** La nota del storyboard del proyecto: la que se pide, la de `carpeta: storyboard`, o una nueva junto al guion. */
async function notaStoryboard(app: App, desde: TFile): Promise<TFile | null> {
  if (propiedades(app, desde).carpeta === 'storyboard') return desde;
  const guion = buscarGuion(app, desde.path);
  if (!guion) return null;
  const hecha = notasDelProyecto(app, guion, 'storyboard')[0];
  if (hecha) return hecha;
  const dir = carpetaDe(guion.path);
  return app.vault.create(normalizePath(`${dir ? dir + '/' : ''}Storyboard.md`), '---\ncarpeta: storyboard\n---\n\n# Storyboard\n');
}

/** Arma o pone al día el storyboard con los planos del guion técnico. Nunca borra dibujos. */
export async function armarStoryboardDe(app: App, desde: TFile, alTerminar?: () => void): Promise<void> {
  const datos = await vinetasDelProyecto(app, desde);
  if (!datos) return void new Notice('Este proyecto no tiene guion: una nota con «carpeta: guion» en esta carpeta.');
  if (!datos.vinetas.length) return void new Notice('El guion técnico todavía no tiene planos: filas con su Escena y su N. de plano.');
  const nota = await notaStoryboard(app, desde);
  if (!nota) return;
  let r: ReturnType<typeof armarStoryboard> | null = null;
  // En el editor, para que Ctrl+Z lo deshaga entero (si el storyboard está cerrado, se abre en una pestaña nueva).
  const n = await aplicarCambios(app, nota, (t) => {
    r = armarStoryboard(t, datos.vinetas.map((x) => x.vineta));
    return r.texto === t ? [] : [{ desde: 0, hasta: t.length, texto: r.texto }];
  });
  const res = r as ReturnType<typeof armarStoryboard> | null;
  if (!res) return;
  if (!n) return void new Notice('El storyboard ya está al día con el guion técnico.');
  const partes = [`${datos.vinetas.length} planos`];
  if (res.nuevas) partes.push(`${res.nuevas} viñetas nuevas`);
  if (res.aMano) partes.push(`${res.aMano} con su tabla escrita a mano (se quedan así)`);
  if (res.huerfanas) partes.push(`${res.huerfanas} que ya no están en el guion técnico, al final con sus dibujos`);
  new Notice(`Storyboard: ${partes.join(' · ')}.`);
  alTerminar?.();
}

const NOMBRES: Record<CampoVineta, string> = { plano: 'plano', lente: 'lente', angulo: 'ángulo', movimiento: 'movimiento', accion: 'acción', dialogo: 'diálogo', sonido: 'sonido' };

/** Escribe en la fila del guion técnico; si no hay dónde, lo dice. */
async function escribirVineta(app: App, v: VinetaEn, listas: ListasTecnicas, todos: [CampoVineta, string][], alTerminar?: () => void): Promise<void> {
  // Solo lo que cambió: «Sonido y diálogo» no escribe el diálogo si nadie lo tocó.
  const valores = todos.filter(([campo, valor]) => valor.trim() !== v.vineta[campo]);
  if (!valores.length) return;
  const faltan: CampoVineta[] = [];
  let cambio = false;
  const n = await aplicarCambios(
    app,
    v.tecnico,
    (t) => {
      // Si el guion técnico cambió mientras se elegía, la fila pudo moverse: no se escribe.
      if (!mismaNota(t, v.texto)) {
        cambio = true;
        return [];
      }
      const cambios: Cambio[] = [];
      for (const [campo, valor] of valores) {
        const cs = cambiarVineta(t, v.vineta.id, campo, valor, listas);
        if (!cs.length) faltan.push(campo);
        cambios.push(...cs);
      }
      return cambios;
    },
    { abrir: false },
  );
  if (cambio) return void new Notice('El guion técnico cambió mientras elegías. Vuelve a pulsar la celda.');
  if (faltan.length) new Notice(`El guion técnico no tiene dónde escribir ${faltan.map((c) => `el ${NOMBRES[c]}`).join(' ni ')} de ${v.vineta.id}. Agrega la columna o usa «Descripción técnica».`);
  if (n) alTerminar?.();
}

export type CampoCelda = 'plano' | 'lente' | 'angulo' | 'movimiento' | 'accion' | 'sonido';

/** El panel de una celda de la viñeta. Lo que se elige se escribe en el guion técnico. */
export function editarVineta(app: App, v: VinetaEn, listas: ListasTecnicas, campo: CampoCelda, ancla: HTMLElement, alTerminar?: () => void): void {
  const x = v.vineta;
  const escribir = (valores: [CampoVineta, string][]) => correr(escribirVineta(app, v, listas, valores, alTerminar));
  if (campo === 'plano') {
    const abreviaturas = abreviaturasDeNota(v.texto) ?? ABREVIATURAS_POR_DEFECTO;
    const conocidas = abreviaturas.map((a) => a.abreviatura);
    new PanelLista(ancla, {
      titulo: `Plano · ${x.id}`,
      opciones: abreviaturas.map((a) => ({ valor: a.abreviatura, detalle: a.nombre })),
      actual: [...conocidas].sort((a, b) => b.length - a.length).find((a) => x.plano === a || x.plano.startsWith(a + ' ')) ?? null,
      // Se cambia la abreviatura y se conserva la descripción («P.G. Restaurante»).
      alElegir: (op) => escribir([['plano', ponerAbreviatura(x.plano, op.valor, conocidas)]]),
      alQuitar: x.plano ? () => escribir([['plano', '']]) : undefined,
      escribir: (t) => escribir([['plano', t]]),
    });
  } else if (campo === 'lente' || campo === 'angulo' || campo === 'movimiento') {
    const opciones = campo === 'lente' ? listas.lentes : campo === 'angulo' ? listas.angulos : listas.movimientos;
    new PanelLista(ancla, {
      titulo: `${campo === 'lente' ? 'Lente' : campo === 'angulo' ? 'Ángulo' : 'Movimiento'} · ${x.id}`,
      opciones: opciones.map((valor) => ({ valor })),
      actual: x[campo] || null,
      alElegir: (op) => escribir([[campo, op.valor]]),
      alQuitar: x[campo] ? () => escribir([[campo, '']]) : undefined,
      // Lo que no está en la lista («cable cam») también se puede escribir.
      escribir: (t) => escribir([[campo, t]]),
    });
  } else if (campo === 'accion') {
    new PanelTexto(ancla, { titulo: `Acción · ${x.id}`, campos: [{ etiqueta: 'Acción', valor: x.accion }], alGuardar: ([a]) => escribir([['accion', a]]) });
  } else {
    new PanelTexto(ancla, {
      titulo: `Sonido y diálogo · ${x.id}`,
      campos: [
        { etiqueta: 'Diálogo', valor: x.dialogo },
        { etiqueta: 'Sonido', valor: x.sonido },
      ],
      alGuardar: ([d, s]) => escribir([
        ['dialogo', d],
        ['sonido', s],
      ]),
    });
  }
}

interface Excalidraw {
  getAPI?(): Excalidraw;
  destroy?(): void;
  reset(): void;
  style: { strokeColor: string; roughness: number; strokeWidth: number };
  addRect(x: number, y: number, ancho: number, alto: number): string;
  create(o: { filename: string; foldername: string; silent: boolean }): Promise<string>;
}

/** Un ExcalidrawAutomate propio (con `getAPI`, para no tocar el que usan los scripts), si el plugin está activo. */
function excalidraw(app: App): { ea: Excalidraw; propio: boolean } | null {
  const plugins = (app as unknown as { plugins?: { plugins?: Record<string, { ea?: unknown }> } }).plugins?.plugins;
  const base = plugins?.['obsidian-excalidraw-plugin']?.ea as Partial<Excalidraw> | undefined;
  const propio = typeof base?.getAPI === 'function';
  const ea = propio ? base.getAPI!() : base;
  return ea && typeof ea.create === 'function' && typeof ea.addRect === 'function' && typeof ea.reset === 'function' ? { ea: ea as Excalidraw, propio } : null;
}

/** Viñetas que se están dibujando: un doble clic no crea dos dibujos. */
const dibujando = new Set<string>();

/**
 * «Dibujar»: crea el dibujo de Excalidraw de la viñeta con un cuadro 16:9, con un nombre que no se repite en la vault
 * («PAPA - E1 P1»), en `Storyboard/` junto al guion; lo pega arriba del bloque de la viñeta y lo abre en una pestaña nueva.
 */
export async function dibujarVineta(app: App, storyboard: TFile, id: string): Promise<void> {
  const clave = `${storyboard.path}#${id}`;
  if (dibujando.has(clave)) return;
  const x = excalidraw(app);
  if (!x) return void new Notice('Para dibujar la viñeta instala y activa el plugin Excalidraw (Ajustes → Plugins de la comunidad).');
  dibujando.add(clave);
  try {
    await crearDibujo(app, x.ea, storyboard, id);
  } finally {
    dibujando.delete(clave);
    // Solo se destruye la instancia propia, nunca la que comparten los scripts.
    if (x.propio) x.ea.destroy?.();
  }
}

async function crearDibujo(app: App, ea: Excalidraw, storyboard: TFile, id: string): Promise<void> {
  const guion = buscarGuion(app, storyboard.path);
  const dir = carpetaDe((guion ?? storyboard).path);
  const proyecto = dir.split('/').pop() || 'Storyboard';
  const carpeta = normalizePath(`${dir ? dir + '/' : ''}Storyboard`);
  if (!(app.vault.getAbstractFileByPath(carpeta) instanceof TFolder)) await app.vault.createFolder(carpeta);
  const base = `${proyecto} - ${id.replace(/\s*·\s*/, ' ')}`.replace(/[\\/:*?"<>|#^[\]]/g, '');
  let nombre = base;
  for (let k = 2; app.metadataCache.getFirstLinkpathDest(`${nombre}.excalidraw`, storyboard.path); k++) nombre = `${base} (${k})`;
  ea.reset();
  ea.style.strokeColor = '#1e1e1e';
  ea.style.strokeWidth = 2;
  ea.style.roughness = 0;
  ea.addRect(0, 0, 1600, 900);
  const ruta = await ea.create({ filename: nombre, foldername: carpeta, silent: true });
  const archivo = app.vault.getAbstractFileByPath(ruta);
  if (!(archivo instanceof TFile)) return void new Notice('Excalidraw no creó el dibujo.');
  const enlace = app.metadataCache.fileToLinktext(archivo, storyboard.path);
  const n = await aplicarCambios(app, storyboard, (t) => insertarDibujo(t, id, enlace), { abrir: false });
  if (!n) new Notice(`Creé «${archivo.basename}», pero no encontré el bloque de ${id} para pegarlo.`);
  await app.workspace.getLeaf('tab').openFile(archivo);
}

export function registrarStoryboard(plugin: Plugin): void {
  const app = plugin.app;
  plugin.addCommand({
    id: 'armar-storyboard',
    name: 'Armar storyboard desde el guion técnico',
    checkCallback: (checking) => {
      const f = app.workspace.getActiveFile();
      if (!f || f.extension !== 'md' || !buscarGuion(app, f.path)) return false;
      if (!checking) correr(armarStoryboardDe(app, f));
      return true;
    },
  });
}
