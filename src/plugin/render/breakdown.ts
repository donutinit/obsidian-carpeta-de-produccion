import { formatearOctavos, type Categoria, type Guion } from '../../motor';
import { claseCategoria, mensaje, SIN_ESCENAS } from './papel';

const conCantidad = (x: { nombre: string; cantidad: number }) => (x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre);

export function renderBreakdown(padre: HTMLElement, g: Guion): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  // Las categorías del proyecto y, al final, los códigos que no son categoría (para que se vean y se corrijan).
  const sueltos = [...new Set(g.breakdown.flatMap((b) => Object.keys(b.elementos)))].filter((c) => !g.config.categorias.some((x) => x.codigo === c));
  const CATEGORIAS: Categoria[] = [...g.config.categorias, ...sueltos.map((c) => ({ codigo: c, nombre: `«${c}» (sin categoría)`, marca: '', tecla: '' }))];
  const caja = padre.createDiv({ cls: 'cp-bd' });
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
      const elementos = c.codigo === 'rep' ? bd.reparto : (bd.elementos[c.codigo] ?? []).map(conCantidad);
      const celda = rejilla.createDiv({ cls: `cp-cell cp-cell-${c.codigo} ${claseCategoria(c.codigo, g.config.categorias)}` });
      celda.createDiv({ cls: 'cp-cell-title', text: c.nombre });
      if (!elementos.length) celda.createDiv({ cls: 'cp-empty', text: '—' });
      else {
        const ul = celda.createEl('ul');
        elementos.forEach((x) => ul.createEl('li', { text: x }));
      }
    }
  });
}
