import { Notice } from 'obsidian';
import type { Beat, CambioVestuario, EscenaDePersonaje } from '../../motor';
import { tablaConCopia } from './plan';

const vacio = (padre: HTMLElement, texto: string) => padre.createDiv({ cls: 'cp-msg', text: texto });

/** La hoja de beats de la clase de dirección de actores: # | Beat | Tema | Quién. Tema lo llena quien dirige. */
export function renderBeats(padre: HTMLElement, escenas: { titulo: string; beats: Beat[] }[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!escenas.length) return void vacio(caja, 'No encontré esa escena en el guion.');
  for (const e of escenas)
    tablaConCopia(caja, `Beats · ${e.titulo}`, ['#', 'Beat', 'Tema', 'Quién'], e.beats.map((b) => [b.numero === null ? '' : String(b.numero), b.beat, '', b.quien]), [0]);
}

/** Las escenas del personaje de la ficha. */
export function renderPersonaje(padre: HTMLElement, nombre: string, escenas: EscenaDePersonaje[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!escenas.length) return void vacio(caja, `«${nombre}» no aparece en el reparto del guion. Revisa que el nombre de la ficha sea el del guion.`);
  const total = escenas.reduce((s, e) => s + e.parlamentos, 0);
  tablaConCopia(caja, `Escenas de ${nombre}`, ['Esc.', 'Encabezado', 'Octavos', 'Parlamentos'], escenas.map((e) => [e.escena, e.encabezado, e.octavos, String(e.parlamentos)]), [0, 2, 3]);
  caja.createDiv({ cls: 'cp-timing-nota', text: `${escenas.length} ${escenas.length === 1 ? 'escena' : 'escenas'} · ${total} ${total === 1 ? 'parlamento' : 'parlamentos'}` });
}

/** Vestuario y maquillaje por personaje, con su código de cambio. */
export function renderVestuario(padre: HTMLElement, datos: { personaje: string; cambios: CambioVestuario[] }[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!datos.length)
    return void vacio(caja, 'Ninguna marca de vestuario o maquillaje dice de quién es. Escribe el nombre así: {vest:traje|Antonio: Traje gris}.');
  const filas = datos.flatMap((p) => p.cambios.map((c) => [c.codigo, p.personaje, c.nombre, c.categoria === 'vest' ? 'Vestuario' : 'Maquillaje y peinado', c.escenas.join(', ')]));
  tablaConCopia(caja, 'Vestuario y maquillaje por personaje', ['Código', 'Personaje', 'Cambio', 'Categoría', 'Escenas'], filas);
}

/** El mapa de cues musicales. */
export function renderCues(padre: HTMLElement, cues: { cue: string; escena: string; nombre: string }[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!cues.length) return void vacio(caja, 'No hay elementos de música y sonido marcados (tecla 7 sobre el texto).');
  tablaConCopia(caja, 'Mapa de cues', ['Cue', 'Esc.', 'Música o sonido'], cues.map((c) => [c.cue, c.escena, c.nombre]), [1]);
}

/** Los créditos como texto, listos para el roll final. */
export function renderCreditos(padre: HTMLElement, c: { equipo: { puesto: string; nombres: string[] }[]; reparto: { personaje: string; actor: string }[] }): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-creditos' });
  if (!c.equipo.length && !c.reparto.length)
    return void vacio(caja, 'No hay datos: llena «equipo» en la ficha del proyecto (Nombre · Matrícula · Puesto) y «actor» en las fichas de personaje.');
  const lineas: string[] = [];
  if (c.reparto.length) {
    lineas.push('Reparto', '');
    for (const r of c.reparto) lineas.push(`${r.personaje} — ${r.actor}`);
    lineas.push('');
  }
  for (const g of c.equipo) lineas.push(g.puesto, ...g.nombres, '');
  const cab = caja.createDiv({ cls: 'cp-timing-cab' });
  cab.createEl('h4', { text: 'Créditos' });
  const copiar = cab.createEl('button', { text: 'Copiar como texto', attr: { type: 'button', 'aria-label': 'Copiar como texto: créditos' } });
  copiar.addEventListener('click', () => {
    navigator.clipboard.writeText(lineas.join('\n').trim() + '\n').then(
      () => new Notice('Créditos copiados.'),
      () => new Notice('No se pudieron copiar.'),
    );
  });
  const lista = caja.createDiv({ cls: 'cp-creditos-lista' });
  for (const l of lineas) lista.createDiv({ text: l || ' ', cls: l && !l.includes('—') && c.equipo.some((g) => g.puesto === l) ? 'cp-creditos-puesto' : l === 'Reparto' ? 'cp-creditos-puesto' : '' });
}
