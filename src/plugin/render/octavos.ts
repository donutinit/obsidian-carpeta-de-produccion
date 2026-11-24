import { formatearOctavos, type Guion } from '../../motor';
import { cajaPaginas, mensaje, renderLineas, SIN_ESCENAS } from './papel';

const NOTA_PRIMERA_PAGINA =
  'Regla izquierda: los 8 octavos de la página. 1 octavo = {pt} pt = {in} pulg. = {lin} líneas de Courier 12. Línea roja: corte entre escenas. Barra vertical: extensión de la escena. Recuadro: escena y octavos de ese tramo.';
/** Alto aproximado del recuadro en renglones: solo escena y octavos, o con «sigue» y total de la escena. */
const ALTO_RECUADRO = 3;
const ALTO_RECUADRO_TOTAL = 8;
const NOTA = '1 octavo = {pt} pt = {in} pulg. = {lin} líneas de Courier 12.';

/** Hoja de octavos: regla de 8 filas, cortes rojos entre escenas, barra por tramo y recuadro con la escena y sus octavos. */
export function renderHojaOctavos(padre: HTMLElement, g: Guion, titulo: string, opts: { alSaltar?: (linea: number) => void } = {}): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  const R = g.config.renglonesPorPagina;
  const renglonesPorOctavo = R / 8;
  const sustituir = (s: string) =>
    s
      .replace('{pt}', String(+(renglonesPorOctavo * 12).toFixed(2)))
      .replace('{in}', String(+((renglonesPorOctavo * 12) / 72).toFixed(3)))
      .replace('{lin}', String(+renglonesPorOctavo.toFixed(3)));
  const dentro = cajaPaginas(padre, 'cp-octs');
  const en = (renglones: number) => `calc(1in + ${renglones * 12}pt)`;
  let acumulado = 0;
  g.paginas.forEach((pg, pi) => {
    const tramos = g.octavos.porPagina[pi] ?? [];
    const dePagina = tramos.reduce((a, t) => a + t.octavos, 0);
    acumulado += dePagina;
    const p = dentro.createDiv({ cls: 'cp-page cp-octpage' });
    if (pi > 0) p.createDiv({ cls: 'cp-pagenum', text: `${pi + 1}.` });
    const cab = p.createDiv({ cls: 'cp-oh' });
    cab.createSpan({ cls: 'cp-oh-tag', text: 'OCTAVOS' });
    cab.createSpan({ text: `${titulo ? titulo + ' · ' : ''}desglose de producción` });
    const nums = tramos.map((t) => g.doc.escenas[t.escena].numero);
    cab.createSpan({ cls: 'cp-oh-r', text: !nums.length ? '' : nums.length === 1 ? `ESCENA ${nums[0]}` : `ESCENAS ${nums[0]}-${nums[nums.length - 1]}` });
    const regla = p.createDiv({ cls: 'cp-ruler' });
    for (let r = 0; r < 8; r++) {
      const fila = regla.createDiv({ cls: 'cp-ruler-row', text: String(r + 1) });
      fila.setCssStyles({ height: `${renglonesPorOctavo * 12}pt` });
    }
    for (let r = 0; r <= 8; r++) p.createDiv({ cls: 'cp-eline' }).setCssStyles({ top: en(r * renglonesPorOctavo) });
    renderLineas(p.createDiv({ cls: 'cp-body' }), g, pg, { numerosEnLinea: true, alSaltar: opts.alSaltar });
    tramos.forEach((t, k) => {
      const escena = g.doc.escenas[t.escena];
      const paginas = g.octavos.paginasPorEscena[t.escena] ?? [];
      // El corte va a media altura del renglón anterior (el blanco antes del encabezado), para no tachar el texto.
      if (k > 0) p.createDiv({ cls: 'cp-cut' }).setCssStyles({ top: `calc(${en(t.inicio)} - 6pt)` });
      const barra = p.createDiv({ cls: 'cp-sbar' });
      barra.setCssStyles({ top: `calc(${en(t.inicio)} + 3pt)`, height: `${Math.max(4, (t.fin - t.inicio) * 12 - 6)}pt` });
      const recuadro = p.createDiv({ cls: 'cp-badge' });
      // Centrado en su tramo, pero sin salirse del área de texto (un tramo corto arriba lo empujaría sobre el encabezado).
      const medioAlto = (paginas.length > 1 ? ALTO_RECUADRO_TOTAL : ALTO_RECUADRO) / 2;
      const centro = Math.min(Math.max((t.inicio + t.fin) / 2, medioAlto), R - medioAlto);
      recuadro.setCssStyles({ top: en(centro) });
      recuadro.createDiv({ cls: 'cp-badge-esc', text: `ESC ${escena.numero}` });
      recuadro.createDiv({ cls: 'cp-badge-e', text: formatearOctavos(t.octavos) });
      if (paginas.length > 1) {
        const primera = paginas[0] === pi + 1;
        recuadro.createDiv({ cls: 'cp-badge-note', text: primera ? 'en esta página · sigue' : `en esta página · viene de la ${paginas[0]}` });
        recuadro.createDiv({ cls: 'cp-badge-tl', text: 'TOTAL ESCENA' });
        recuadro.createDiv({ cls: 'cp-badge-total', text: formatearOctavos(g.octavos.porEscena[t.escena]) });
      }
    });
    const pie = p.createDiv({ cls: 'cp-of' });
    pie.createSpan({ text: sustituir(pi === 0 ? NOTA_PRIMERA_PAGINA : NOTA) });
    pie.createSpan({ cls: 'cp-of-r', text: `PÁGINA ${pi + 1} DE ${g.paginas.length} · ${dePagina}/8 · ACUMULADO ${acumulado}/8` });
  });
}

export function renderTablaOctavos(padre: HTMLElement, g: Guion): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  const caja = padre.createDiv({ cls: 'cp-table-box' });
  const tabla = caja.createEl('table', { cls: 'cp-table' });
  const cab = tabla.createEl('thead').createEl('tr');
  ['Esc.', 'Encabezado', 'Página', 'Octavos', 'Acumulado'].forEach((t) => cab.createEl('th', { text: t }));
  const cuerpo = tabla.createEl('tbody');
  let acumulado = 0;
  g.doc.escenas.forEach((s, k) => {
    const oct = g.octavos.porEscena[k];
    acumulado += oct;
    const r = cuerpo.createEl('tr');
    r.createEl('td', { text: s.numero, cls: 'cp-num' });
    r.createEl('td', { text: s.encabezado });
    r.createEl('td', { text: (g.octavos.paginasPorEscena[k] ?? []).join(', '), cls: 'cp-num' });
    r.createEl('td', { text: formatearOctavos(oct), cls: 'cp-num' });
    r.createEl('td', { text: `${acumulado}/8`, cls: 'cp-num' });
  });
  const pie = tabla.createEl('tfoot').createEl('tr');
  pie.createEl('td');
  pie.createEl('td', { text: `Total · ${g.paginas.length} ${g.paginas.length === 1 ? 'página' : 'páginas'}` });
  pie.createEl('td');
  pie.createEl('td', { text: formatearOctavos(g.octavos.total), cls: 'cp-num' });
  pie.createEl('td', { text: `${g.octavos.total}/8`, cls: 'cp-num' });
}
