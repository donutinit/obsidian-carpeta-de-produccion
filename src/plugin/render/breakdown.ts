import { setIcon } from 'obsidian';
import { formatearOctavos, presentaciones, type Categoria, type Guion } from '../../motor';
import { claseCategoria, mensaje, SIN_ESCENAS } from './papel';

const conCantidad = (x: { nombre: string; cantidad: number }) => (x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre);

/** Lo que la hoja deja hacer en una nota. Sin acciones (el PDF), la hoja es solo para leer. */
export interface AccionesBreakdown {
  agregar(k: number, cat: string, ancla: HTMLElement): void;
  quitar(k: number, cat: string, nombre: string): void;
  /** Para quien cuenta en el reparto solo porque se presentó con edad («Tele (32)»). */
  noEsPersonaje?(nombre: string): void;
}

/** Quien está en el reparto solo porque la acción lo presentó con edad: ni habla ni está marcado. */
export function soloPresentados(g: Guion): (nombre: string) => boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const presentados = new Set(presentaciones(g.doc).map((p) => n(p.nombre)));
  const hablan = new Set(g.doc.elementos.filter((e) => e.tipo === 'personaje' && e.nombre).map((e) => n(e.nombre ?? '')));
  const marcados = new Set(g.breakdown.flatMap((b) => (b.elementos.rep ?? []).map((x) => n(x.nombre))));
  return (nombre) => presentados.has(n(nombre)) && !hablan.has(n(nombre)) && !marcados.has(n(nombre));
}

export function renderBreakdown(padre: HTMLElement, g: Guion, acciones?: AccionesBreakdown): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  // Las categorías del proyecto y, al final, los códigos que no son categoría (para que se vean y se corrijan).
  const sueltos = [...new Set(g.breakdown.flatMap((b) => Object.keys(b.elementos)))].filter((c) => !g.config.categorias.some((x) => x.codigo === c));
  const CATEGORIAS: Categoria[] = [...g.config.categorias, ...sueltos.map((c) => ({ codigo: c, nombre: `«${c}» (sin categoría)`, marca: '', tecla: '' }))];
  const caja = padre.createDiv({ cls: 'cp-bd' });
  const presentadoSolo = soloPresentados(g);
  caja.createEl('h3', { text: 'Índice de desglose' });
  const tabla = caja.createEl('table', { cls: 'cp-table' });
  const cab = tabla.createEl('thead').createEl('tr');
  ['Esc.', 'INT./EXT.', 'Locación', 'Momento', 'Octavos', 'Pág.', 'Reparto'].forEach((t) => cab.createEl('th', { text: t }));
  const cuerpo = tabla.createEl('tbody');
  g.doc.escenas.forEach((s, k) => {
    const r = cuerpo.createEl('tr');
    [s.numero, s.introduccion, s.locacion, s.momento, formatearOctavos(g.octavos.porEscena[k]), (g.octavos.paginasPorEscena[k] ?? []).join(', '), g.breakdown[k].reparto.join(', ')].forEach(
      (t, i) => r.createEl('td', { text: t || '—', cls: [0, 4, 5].includes(i) ? 'cp-num' : '' }),
    );
  });
  const leyenda = caja.createDiv({ cls: 'cp-legend' });
  for (const c of CATEGORIAS) leyenda.createSpan({ cls: 'cp-legend-item' }).createSpan({ cls: 'cp-mark ' + claseCategoria(c.codigo, g.config.categorias), text: c.nombre });
  g.doc.escenas.forEach((s, k) => {
    const bd = g.breakdown[k];
    const hoja = caja.createDiv({ cls: 'cp-sheet' });
    const cabeza = hoja.createDiv({ cls: 'cp-sheet-head' });
    cabeza.createSpan({ cls: 'cp-sheet-num', text: `Escena ${s.numero}` });
    cabeza.createSpan({ cls: 'cp-sheet-title', text: s.locacion || s.encabezado });
    const meta = hoja.createDiv({ cls: 'cp-sheet-meta' });
    (
      [
        ['INT./EXT.', s.introduccion],
        ['Momento', s.momento],
        ['Octavos', formatearOctavos(g.octavos.porEscena[k])],
        ['Página', (g.octavos.paginasPorEscena[k] ?? []).join(', ')],
      ] as const
    ).forEach(([clave, valor]) => {
      const m = meta.createSpan();
      m.createSpan({ cls: 'cp-k', text: clave + ' ' });
      m.createSpan({ text: valor || '—' });
    });
    const rejilla = hoja.createDiv({ cls: 'cp-grid' });
    for (const c of CATEGORIAS) {
      const elementos =
        c.codigo === 'rep'
          ? bd.reparto.map((n) => ({ texto: n, nombre: n, tecnico: false, quitable: (bd.elementos.rep ?? []).some((x) => x.nombre.toLowerCase() === n.toLowerCase()), presentado: presentadoSolo(n) }))
          : (bd.elementos[c.codigo] ?? []).map((x) => ({ texto: conCantidad(x), nombre: x.nombre, tecnico: x.origen === 'tecnico', quitable: true, presentado: false }));
      const celda = rejilla.createDiv({ cls: `cp-cell cp-cell-${c.codigo} ${claseCategoria(c.codigo, g.config.categorias)}` });
      celda.createDiv({ cls: 'cp-cell-title', text: c.nombre });
      if (!elementos.length && !acciones) celda.createDiv({ cls: 'cp-empty', text: '—' });
      if (elementos.length) {
        const ul = celda.createEl('ul');
        for (const x of elementos) {
          const li = ul.createEl('li', { text: x.texto });
          if (!acciones) continue;
          if (x.tecnico) {
            // Del guion técnico: se cambia ahí, no aquí.
            const t = li.createSpan({ cls: 'cp-bd-tecnico', attr: { role: 'img', 'aria-label': 'Del guion técnico' } });
            setIcon(t, 'cog');
            t.title = 'Del guion técnico: se cambia ahí';
          } else if (x.quitable) {
            // En el reparto solo se quita lo marcado; quien habla está en la escena por su diálogo.
            const b = li.createEl('button', { cls: 'cp-bd-quitar clickable-icon', attr: { type: 'button', 'aria-label': `Quitar «${x.nombre}» de la escena ${s.numero}` } });
            setIcon(b, 'x');
            b.addEventListener('click', () => acciones.quitar(k, c.codigo, x.nombre));
          } else if (x.presentado && acciones.noEsPersonaje) {
            const b = li.createEl('button', { cls: 'cp-bd-quitar clickable-icon', attr: { type: 'button', 'aria-label': `«${x.nombre}» no es personaje` } });
            setIcon(b, 'x');
            b.addEventListener('click', () => acciones.noEsPersonaje?.(x.nombre));
          }
        }
      }
      // Los códigos que no son categoría no se agregan: solo se ven para corregirlos.
      if (acciones && !sueltos.includes(c.codigo)) {
        const b = celda.createEl('button', { cls: 'cp-bd-agregar', text: '+ Agregar', attr: { type: 'button', 'aria-label': `Agregar a ${c.nombre}, escena ${s.numero}` } });
        b.addEventListener('click', () => acciones.agregar(k, c.codigo, b));
      }
    }
  });
}
