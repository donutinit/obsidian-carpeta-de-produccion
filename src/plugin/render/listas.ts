import { formatearDuracion, formatearOctavos, listaElementos, listaLocaciones, listaReparto, type Guion } from '../../motor';
import { claseCategoria, mensaje, SIN_ESCENAS } from './papel';

function tabla(padre: HTMLElement, titulo: string, cabeza: string[], filas: (string | number)[][], numericas: number[] = []): void {
  const caja = padre.createDiv({ cls: 'cp-bd' });
  caja.createEl('h3', { text: titulo });
  if (!filas.length) {
    caja.createDiv({ cls: 'cp-msg', text: 'Nada que listar todavía.' });
    return;
  }
  const t = caja.createEl('table', { cls: 'cp-table' });
  const tr = t.createEl('thead').createEl('tr');
  cabeza.forEach((c) => tr.createEl('th', { text: c }));
  const cuerpo = t.createEl('tbody');
  for (const f of filas) {
    const r = cuerpo.createEl('tr');
    f.forEach((x, i) => r.createEl('td', { text: String(x) || '—', cls: numericas.includes(i) ? 'cp-num' : '' }));
  }
}

export function renderReparto(padre: HTMLElement, g: Guion, orden: string[] = []): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  tabla(
    padre,
    'Lista de reparto',
    ['ID', 'Personaje', 'Escenas', 'Núm.', 'Octavos', 'Duración'],
    listaReparto(g, orden).map((r) => [r.id, r.nombre, r.escenas.join(', '), r.escenas.length, formatearOctavos(r.octavos), formatearDuracion(r.segundos)]),
    [0, 3, 4, 5],
  );
}

export function renderLocaciones(padre: HTMLElement, g: Guion): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  tabla(
    padre,
    'Lista de locaciones',
    ['Complejo', 'Set', 'INT./EXT.', 'Escenas', 'Octavos', 'Duración', 'Reparto'],
    listaLocaciones(g).map((l) => [l.complejo, l.set, l.intExt.join(', '), l.escenas.join(', '), formatearOctavos(l.octavos), formatearDuracion(l.segundos), l.reparto.join(', ')]),
    [4, 5],
  );
}

/** Elementos de una categoría o de todas (sin el reparto), con la cantidad máxima por escena. */
export function renderElementos(padre: HTMLElement, g: Guion, codigo?: string): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  const filas = listaElementos(g, codigo);
  const cats = g.config.categorias;
  const nombre = (c: string) => cats.find((x) => x.codigo === c)?.nombre ?? `«${c}» (sin categoría)`;
  const titulo = codigo ? nombre(codigo) : 'Elementos de producción';
  const caja = padre.createDiv({ cls: 'cp-bd' });
  caja.createEl('h3', { text: titulo });
  if (!filas.length) {
    caja.createDiv({ cls: 'cp-msg', text: 'Nada que listar todavía.' });
    return;
  }
  const t = caja.createEl('table', { cls: 'cp-table' });
  const tr = t.createEl('thead').createEl('tr');
  ['Categoría', 'Elemento', 'Cantidad', 'Escenas'].forEach((c) => tr.createEl('th', { text: c }));
  const cuerpo = t.createEl('tbody');
  for (const f of filas) {
    const r = cuerpo.createEl('tr');
    r.createEl('td').createSpan({ cls: 'cp-mark ' + claseCategoria(f.codigo, cats), text: nombre(f.codigo) });
    r.createEl('td', { text: f.nombre });
    r.createEl('td', { text: String(f.cantidad), cls: 'cp-num' });
    r.createEl('td', { text: f.escenas.join(', ') });
  }
}
