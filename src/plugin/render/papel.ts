import { CATEGORIAS, formatearOctavos, textoPlano, analizarEnLinea, type Categoria, type Guion, type Pagina, type Segmento } from '../../motor';

export const SIN_ESCENAS = 'No hay escenas todavía.';

/** Clase de color de una categoría: `cp-t-<estilo o código>`, o `cp-t-x` si el código no es categoría del proyecto. */
export function claseCategoria(cat: string, categorias: Categoria[] = CATEGORIAS): string {
  const c = categorias.find((x) => x.codigo === cat);
  return 'cp-t-' + (c ? (c.estilo ?? c.codigo) : 'x');
}

export function renderSegs(padre: HTMLElement, segs: Segmento[], categorias: Categoria[] = CATEGORIAS): void {
  for (const s of segs) {
    if (!s.t) continue;
    const sp = padre.createSpan({ text: s.t });
    if (s.b) sp.addClass('cp-b');
    if (s.i) sp.addClass('cp-i');
    if (s.u) sp.addClass('cp-u');
    if (s.cat) {
      sp.addClass('cp-t', claseCategoria(s.cat, categorias));
      const cantidad = s.cantidad && s.cantidad > 1 ? ` (×${s.cantidad})` : '';
      sp.setAttr('title', `${categorias.find((c) => c.codigo === s.cat)?.nombre ?? s.cat}: ${s.item ?? s.t}${cantidad}`);
    }
  }
}

/** Contenedor de páginas que se ajusta al ancho del panel (las páginas miden 8.5 in = 816 px). */
export function cajaPaginas(padre: HTMLElement, cls = ''): HTMLElement {
  const caja = padre.createDiv({ cls: 'cp-pages' + (cls ? ' ' + cls : '') });
  const dentro = caja.createDiv({ cls: 'cp-pages-inner' });
  const ajustar = () => {
    const w = caja.clientWidth;
    if (w > 0) dentro.setCssStyles({ zoom: String(Math.min(1, (w - 8) / 816)) });
  };
  window.requestAnimationFrame(ajustar);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (!caja.isConnected) ro.disconnect();
      else window.requestAnimationFrame(ajustar);
    });
    ro.observe(caja);
  }
  return dentro;
}

export interface OpcionesLineas {
  numerosEnLinea?: boolean;
  subrayado?: boolean;
  /** Sides: resalta los renglones de este personaje (en mayúsculas). */
  resaltar?: string;
  alSaltar?: (linea: number) => void;
}

export function renderLineas(cuerpo: HTMLElement, g: Guion, pagina: Pagina, opts: OpcionesLineas): void {
  for (const l of pagina.lineas) {
    const d = cuerpo.createDiv({ cls: 'cp-line cp-' + l.tipo });
    if (l.tipo === 'blanco') {
      d.setText(' ');
      continue;
    }
    d.setCssStyles({ paddingLeft: l.columna + 'ch' });
    const escena = l.primeraDeEscena ? g.doc.escenas[l.escena] : undefined;
    if (escena && opts.numerosEnLinea) d.createSpan({ text: `${escena.numero}. ` });
    renderSegs(d, l.segs, g.config.categorias);
    if (opts.resaltar && l.hablante === opts.resaltar && l.segs.length) d.addClass('cp-side');
    if (l.der) {
      // Diálogo dual: la columna derecha va en su posición exacta de la rejilla.
      const der = d.createSpan({ cls: 'cp-dual-der cp-' + l.der.tipo + (opts.resaltar && l.der.hablante === opts.resaltar ? ' cp-side' : '') });
      der.setCssStyles({ left: l.der.columna + 'ch' });
      renderSegs(der, l.der.segs, g.config.categorias);
    }
    if ([...l.segs, ...(l.der?.segs ?? [])].some((s) => s.cat === 'nota')) d.createSpan({ cls: 'cp-n', text: 'N' });
    if (escena) {
      d.createSpan({ cls: 'cp-scnum cp-scnum-l', text: escena.numero });
      d.createSpan({ cls: 'cp-scnum cp-scnum-r', text: escena.numero });
      if (opts.subrayado) d.createSpan({ cls: 'cp-oct', text: formatearOctavos(g.octavos.porEscena[l.escena] ?? 0) });
    }
    if (escena && opts.alSaltar && l.fuente !== undefined) {
      const fuente = l.fuente;
      const saltar = opts.alSaltar;
      d.addClass('cp-click');
      d.onclick = () => saltar(fuente);
    }
  }
}

export function renderPortada(padre: HTMLElement, g: Guion): void {
  const t = g.doc.portada;
  if (!Object.keys(t).length) return;
  const pg = padre.createDiv({ cls: 'cp-page cp-titlepage' });
  const medio = pg.createDiv({ cls: 'cp-tp-mid' });
  for (const l of t.title ?? []) renderSegs(medio.createDiv({ cls: 'cp-tp-title' }), analizarEnLinea(l));
  for (const k of ['credit', 'author', 'source']) for (const l of t[k] ?? []) renderSegs(medio.createDiv({ cls: 'cp-tp-line' }), analizarEnLinea(l));
  const izq = pg.createDiv({ cls: 'cp-tp-bl' });
  for (const k of ['contact', 'copyright']) for (const l of t[k] ?? []) renderSegs(izq.createDiv(), analizarEnLinea(l));
  const der = pg.createDiv({ cls: 'cp-tp-br' });
  for (const k of ['date', 'notes']) for (const l of t[k] ?? []) renderSegs(der.createDiv(), analizarEnLinea(l));
}

export const tituloDe = (g: Guion) => textoPlano(analizarEnLinea((g.doc.portada.title ?? [''])[0] ?? ''));

export function mensaje(padre: HTMLElement, texto: string): void {
  padre.createDiv({ cls: 'cp-msg', text: texto });
}

export function renderGuion(padre: HTMLElement, g: Guion, opts: { subrayado?: boolean; portada?: boolean; resaltar?: string; alSaltar?: (linea: number) => void }): void {
  if (!g.doc.escenas.length) return mensaje(padre, SIN_ESCENAS);
  const dentro = cajaPaginas(padre, opts.subrayado ? 'cp-sub' : '');
  if (opts.portada !== false) renderPortada(dentro, g);
  g.paginas.forEach((pg, pi) => {
    const p = dentro.createDiv({ cls: 'cp-page' });
    if (pi > 0) p.createDiv({ cls: 'cp-pagenum', text: `${pi + 1}.` });
    renderLineas(p.createDiv({ cls: 'cp-body' }), g, pg, { subrayado: opts.subrayado, resaltar: opts.resaltar, alSaltar: opts.alSaltar });
  });
}
