import {
  cuadriculaMes,
  DIAS,
  DIAS_CORTOS,
  diaDeLaSemana,
  escribirFecha,
  escribirTecnica,
  filtrarOpciones,
  MESES,
  mismaFecha,
  sumarDias,
  sumarMeses,
  type Fecha,
  type ListasTecnicas,
  type Tecnica,
} from '../motor';

/**
 * Un panel flotante junto a una celda. Se cierra al pulsar fuera, con Esc, al elegir, o si la celda sale de la
 * pantalla; al desplazarse la nota o cambiar el tamaño de la ventana, sigue a su celda.
 */
export abstract class Panel {
  static abierto: Panel | null = null;
  protected readonly el: HTMLElement;
  protected readonly doc: Document;
  private cerrado = false;
  private readonly quitarEscuchas: (() => void)[] = [];

  constructor(
    protected readonly ancla: HTMLElement,
    cls: string,
    etiqueta: string,
  ) {
    Panel.abierto?.cerrar();
    this.doc = ancla.ownerDocument;
    this.el = this.doc.body.createDiv({ cls: `cp-panel ${cls}`, attr: { role: 'dialog', 'aria-label': etiqueta } });
  }

  /** Lo llama cada panel cuando ya armó su contenido. */
  protected iniciar(): void {
    this.colocar();
    this.escuchar(this.doc, 'mousedown', (e) => !this.el.contains(e.target as Node) && this.cerrar(), true);
    this.escuchar(this.doc, 'scroll', (e) => !this.el.contains(e.target as Node) && this.seguir(), true);
    // En el celular el teclado cambia el tamaño de la ventana: se reacomoda en vez de cerrarse.
    this.escuchar(this.doc.defaultView ?? window, 'resize', () => this.seguir());
    this.escuchar(this.el, 'keydown', (e) => this.teclaBase(e as KeyboardEvent));
    Panel.abierto = this;
    this.enfocar();
    // Al pulsar una celda, Obsidian enfoca su editor de celda después de este clic: se recupera el foco.
    (this.doc.defaultView ?? window).setTimeout(() => {
      if (!this.cerrado && !this.el.contains(this.doc.activeElement)) this.enfocar();
    }, 60);
  }

  /** Pone el foco del teclado donde empieza cada panel. */
  protected abstract enfocar(): void;

  /** Devuelve `true` si atendió la tecla. */
  protected abstract tecla(e: KeyboardEvent): boolean;

  private teclaBase(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cerrar();
      this.volverACelda();
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey && this.tecla(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  protected escuchar(blanco: EventTarget, tipo: string, fn: (e: Event) => unknown, captura = false): void {
    blanco.addEventListener(tipo, fn, captura);
    this.quitarEscuchas.push(() => blanco.removeEventListener(tipo, fn, captura));
  }

  protected boton(padre: HTMLElement, texto: string, etiqueta: string, fn: () => void, cls = ''): HTMLButtonElement {
    const b = padre.createEl('button', { text: texto, cls, attr: { type: 'button', 'aria-label': etiqueta } });
    b.addEventListener('click', fn);
    return b;
  }

  private colocar() {
    const r = this.ancla.getBoundingClientRect();
    const vista = this.doc.defaultView ?? window;
    const { width: w, height: h } = this.el.getBoundingClientRect();
    const izq = Math.max(8, Math.min(r.left, vista.innerWidth - w - 8));
    const abajo = r.bottom + 4;
    const arriba = abajo + h > vista.innerHeight - 8 && r.top - h - 4 >= 8;
    this.el.setCssStyles({ left: `${izq}px`, top: `${arriba ? r.top - h - 4 : Math.max(8, Math.min(abajo, vista.innerHeight - h - 8))}px` });
  }

  private seguir() {
    const r = this.ancla.getBoundingClientRect();
    const vista = this.doc.defaultView ?? window;
    if (!this.ancla.isConnected || r.bottom < 0 || r.top > vista.innerHeight) this.cerrar();
    else this.colocar();
  }

  /** En la vista en vivo, el foco vuelve al editor de la celda para escribir a mano. */
  protected volverACelda(): void {
    this.ancla.querySelector<HTMLElement>('.cm-content')?.focus();
  }

  /** «Escribir a mano»: cierra el panel y deja el cursor en la celda. */
  protected botonAMano(pie: HTMLElement): void {
    this.boton(pie, 'Escribir a mano', 'Cerrar el panel y escribir en la celda', () => {
      this.cerrar();
      this.volverACelda();
    });
  }

  /** Cierra el panel y, si sigue abierto, corre `fn`. */
  protected terminar(fn: () => void): void {
    if (this.cerrado) return;
    this.cerrar();
    fn();
  }

  cerrar(): void {
    if (this.cerrado) return;
    this.cerrado = true;
    for (const q of this.quitarEscuchas) q();
    this.el.remove();
    if (Panel.abierto === this) Panel.abierto = null;
  }
}

// ---------- Calendario ----------

const hoy = (): Fecha => {
  const x = new Date();
  return { a: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() };
};

const nombreLargo = (f: Fecha) => `${DIAS[diaDeLaSemana(f)]} ${f.d} de ${MESES[f.m - 1]} de ${f.a}`;

export interface OpcionesCalendario {
  valor: Fecha | null;
  /** La otra punta del periodo (el Inicio cuando se elige el Fin), marcada en el calendario. */
  pareja: { nombre: string; fecha: Fecha } | null;
  puedeQuitar: boolean;
  alElegir: (f: Fecha | null) => void;
}

/** Teclado: flechas, Re Pág/Av Pág, Inicio/Fin, Enter o Espacio, y Esc. */
export class Calendario extends Panel {
  private rejilla!: HTMLElement;
  private titulo!: HTMLElement;
  private foco: Fecha;

  constructor(
    ancla: HTMLElement,
    private o: OpcionesCalendario,
  ) {
    super(ancla, 'cp-calendario', 'Elegir fecha');
    this.foco = o.valor ?? o.pareja?.fecha ?? hoy();
    this.armar();
    this.pintar(false);
    this.iniciar();
  }

  protected enfocar(): void {
    this.enfocarDia();
  }

  private armar() {
    const cab = this.el.createDiv({ cls: 'cp-cal-cab' });
    this.boton(cab, '‹', 'Mes anterior', () => this.mover(sumarMeses(this.foco, -1)), 'cp-cal-flecha');
    this.titulo = cab.createDiv({ cls: 'cp-cal-titulo', attr: { 'aria-live': 'polite' } });
    this.boton(cab, '›', 'Mes siguiente', () => this.mover(sumarMeses(this.foco, 1)), 'cp-cal-flecha');
    const dias = this.el.createDiv({ cls: 'cp-cal-semana', attr: { 'aria-hidden': 'true' } });
    for (const d of DIAS_CORTOS) dias.createDiv({ text: d });
    this.rejilla = this.el.createDiv({ cls: 'cp-cal-rejilla', attr: { role: 'grid' } });
    if (this.o.pareja) {
      const ley = this.el.createDiv({ cls: 'cp-cal-leyenda' });
      ley.createSpan({ cls: 'cp-cal-muestra', text: this.o.pareja.nombre });
      ley.createSpan({ text: escribirFecha(this.o.pareja.fecha) });
    }
    const pie = this.el.createDiv({ cls: 'cp-panel-pie' });
    this.boton(pie, 'Hoy', 'Elegir hoy', () => this.terminar(() => this.o.alElegir(hoy())));
    if (this.o.puedeQuitar) this.boton(pie, 'Quitar fecha', 'Quitar la fecha de la celda', () => this.terminar(() => this.o.alElegir(null)));
    this.botonAMano(pie);
  }

  private pintar(enfocar: boolean) {
    const { a, m } = this.foco;
    this.titulo.setText(`${MESES[m - 1]} ${a}`);
    this.rejilla.empty();
    const hoyEs = hoy();
    for (const semana of cuadriculaMes(a, m)) {
      const fila = this.rejilla.createDiv({ cls: 'cp-cal-fila', attr: { role: 'row' } });
      for (const d of semana) {
        if (d === null) {
          fila.createDiv({ cls: 'cp-cal-vacio', attr: { role: 'gridcell' } });
          continue;
        }
        const f = { a, m, d };
        const cls = ['cp-cal-dia'];
        if (mismaFecha(f, this.o.valor)) cls.push('is-elegido');
        if (mismaFecha(f, hoyEs)) cls.push('is-hoy');
        if (mismaFecha(f, this.o.pareja?.fecha)) cls.push('is-pareja');
        const b = fila.createDiv({ attr: { role: 'gridcell' } }).createEl('button', {
          text: String(d),
          cls: cls.join(' '),
          attr: { type: 'button', tabindex: mismaFecha(f, this.foco) ? '0' : '-1', 'aria-label': nombreLargo(f), 'aria-pressed': String(mismaFecha(f, this.o.valor)), 'data-dia': String(d) },
        });
        b.addEventListener('click', () => this.terminar(() => this.o.alElegir(f)));
      }
    }
    if (enfocar) this.enfocarDia();
  }

  private enfocarDia() {
    this.rejilla.querySelector<HTMLElement>(`[data-dia="${this.foco.d}"]`)?.focus({ preventScroll: true });
  }

  private mover(f: Fecha) {
    const otroMes = f.a !== this.foco.a || f.m !== this.foco.m;
    this.foco = f;
    if (otroMes) this.pintar(true);
    else {
      for (const b of Array.from(this.rejilla.querySelectorAll<HTMLElement>('[data-dia]'))) b.tabIndex = b.dataset.dia === String(f.d) ? 0 : -1;
      this.enfocarDia();
    }
  }

  protected tecla(e: KeyboardEvent): boolean {
    if (!this.rejilla.contains(e.target as Node)) return false;
    const pasos: Record<string, () => Fecha> = {
      ArrowLeft: () => sumarDias(this.foco, -1),
      ArrowRight: () => sumarDias(this.foco, 1),
      ArrowUp: () => sumarDias(this.foco, -7),
      ArrowDown: () => sumarDias(this.foco, 7),
      PageUp: () => sumarMeses(this.foco, -1),
      PageDown: () => sumarMeses(this.foco, 1),
      Home: () => sumarDias(this.foco, -diaDeLaSemana(this.foco)),
      End: () => sumarDias(this.foco, 6 - diaDeLaSemana(this.foco)),
    };
    if (e.key === 'Enter' || e.key === ' ') {
      const f = this.foco;
      this.terminar(() => this.o.alElegir(f));
      return true;
    }
    if (!pasos[e.key]) return false;
    this.mover(pasos[e.key]());
    return true;
  }
}

// ---------- Lista ----------

export interface OpcionLista {
  valor: string;
  /** Para distinguir opciones con el mismo valor (dos escenas con el mismo número fijo). */
  clave?: string;
  /** Lo que se ve en negritas; si falta, el valor. */
  etiqueta?: string;
  detalle?: string;
}

export interface OpcionesLista {
  titulo: string;
  opciones: OpcionLista[];
  /** El valor que ya tiene la celda, marcado. */
  actual: string | null;
  alElegir: (op: OpcionLista) => void;
  /** Si está, aparece «Quitar» en el pie. */
  alQuitar?: () => void;
  /**
   * Si está, el buscador siempre se ve y lo escrito que no esté en la lista se puede agregar con la última fila,
   * «Agregar «…»». No hay «Escribir a mano»: no hay celda a la cual volver.
   */
  escribir?: (texto: string) => void;
  /** Botones del pie que hacen algo más que elegir una opción («Llenar toda la tabla»). */
  acciones?: { texto: string; etiqueta: string; fn: () => void }[];
}

/** La fila «Agregar «…»» de una lista con `escribir`. */
const NUEVO = '\u0000nuevo';
const comparable = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Una lista con filtro (si es larga). Teclado: escribir filtra, flechas, Enter y Esc. */
export class PanelLista extends Panel {
  private lista!: HTMLElement;
  private filtro: HTMLInputElement | null = null;
  private visibles: OpcionLista[] = [];
  private activo = 0;

  constructor(
    ancla: HTMLElement,
    private o: OpcionesLista,
  ) {
    super(ancla, 'cp-lista', o.titulo);
    this.el.createDiv({ cls: 'cp-panel-titulo', text: o.titulo });
    if (o.opciones.length > 8 || o.escribir) {
      const ph = o.escribir ? 'Buscar o escribir…' : 'Filtrar…';
      this.filtro = this.el.createEl('input', { cls: 'cp-lista-filtro', attr: { type: 'text', placeholder: ph, 'aria-label': ph.slice(0, -1) } });
      this.filtro.addEventListener('input', () => this.pintar(0));
    }
    this.lista = this.el.createDiv({ cls: 'cp-lista-ops', attr: { role: 'listbox', 'aria-label': o.titulo } });
    const pie = this.el.createDiv({ cls: 'cp-panel-pie' });
    if (o.alQuitar) {
      const quitar = o.alQuitar;
      this.boton(pie, 'Quitar', 'Dejar la celda vacía', () => this.terminar(quitar));
    }
    for (const a of o.acciones ?? []) this.boton(pie, a.texto, a.etiqueta, () => this.terminar(a.fn));
    if (!o.escribir) this.botonAMano(pie);
    if (!pie.childElementCount) pie.remove();
    const k = o.opciones.findIndex((x) => x.valor === o.actual);
    this.pintar(Math.max(0, k));
    this.iniciar();
    this.lista.querySelector<HTMLElement>('.is-activo')?.scrollIntoView({ block: 'nearest' });
  }

  protected enfocar(): void {
    if (this.filtro) this.filtro.focus({ preventScroll: true });
    else this.enfocarActivo();
  }

  private pintar(activo: number) {
    const texto = this.filtro?.value.trim() ?? '';
    this.visibles = filtrarOpciones(this.o.opciones, texto);
    // Lo escrito que no está en la lista va al final: Enter sigue eligiendo la primera coincidencia.
    if (this.o.escribir && texto && !this.o.opciones.some((x) => comparable(x.valor) === comparable(texto))) this.visibles.push({ valor: texto, clave: NUEVO, etiqueta: `Agregar «${texto}»` });
    this.activo = Math.min(activo, Math.max(0, this.visibles.length - 1));
    this.lista.empty();
    if (!this.visibles.length) this.lista.createDiv({ cls: 'cp-lista-nada', text: this.o.escribir ? 'Escribe el nombre para agregarlo.' : 'Nada coincide.' });
    this.visibles.forEach((x, k) => {
      const cls = ['cp-lista-op'];
      if (x.valor === this.o.actual) cls.push('is-elegido');
      if (k === this.activo) cls.push('is-activo');
      const b = this.lista.createEl('button', {
        cls: cls.join(' '),
        attr: { type: 'button', role: 'option', tabindex: k === this.activo && !this.filtro ? '0' : '-1', 'aria-selected': String(x.valor === this.o.actual) },
      });
      b.createSpan({ cls: 'cp-lista-valor', text: x.etiqueta ?? x.valor });
      if (x.detalle) b.createSpan({ cls: 'cp-lista-detalle', text: x.detalle });
      b.addEventListener('click', () => this.terminar(() => this.elegir(x)));
    });
  }

  private elegir(x: OpcionLista) {
    if (x.clave === NUEVO && this.o.escribir) this.o.escribir(x.valor);
    else this.o.alElegir(x);
  }

  private enfocarActivo() {
    this.lista.querySelectorAll<HTMLElement>('.cp-lista-op')[this.activo]?.focus({ preventScroll: true });
  }

  private mover(d: number) {
    if (!this.visibles.length) return;
    const k = (this.activo + d + this.visibles.length) % this.visibles.length;
    this.pintar(k);
    const b = this.lista.querySelectorAll<HTMLElement>('.cp-lista-op')[k];
    b?.scrollIntoView({ block: 'nearest' });
    if (!this.filtro) this.enfocarActivo();
  }

  protected tecla(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') this.mover(1);
    else if (e.key === 'ArrowUp') this.mover(-1);
    else if (e.key === 'Enter') {
      // Enter sobre un botón del pie («Llenar toda la tabla») hace lo de ese botón.
      if ((e.target as HTMLElement | null)?.closest?.('.cp-panel-pie')) return false;
      const x = this.visibles[this.activo];
      if (x) this.terminar(() => this.elegir(x));
    } else return false;
    return true;
  }
}

// ---------- Texto ----------

export interface OpcionesTexto {
  titulo: string;
  campos: { etiqueta: string; valor: string }[];
  alGuardar: (valores: string[]) => void;
}

/** Uno o varios renglones de texto («Acción», «Diálogo» y «Sonido»). Enter guarda; Esc cancela. */
export class PanelTexto extends Panel {
  private entradas: HTMLInputElement[] = [];

  constructor(
    ancla: HTMLElement,
    private o: OpcionesTexto,
  ) {
    super(ancla, 'cp-texto', o.titulo);
    this.el.createDiv({ cls: 'cp-panel-titulo', text: o.titulo });
    for (const c of o.campos) {
      const l = this.el.createEl('label', { cls: 'cp-texto-campo' });
      l.createSpan({ text: c.etiqueta });
      const i = l.createEl('input', { attr: { type: 'text' } });
      i.value = c.valor;
      this.entradas.push(i);
    }
    const pie = this.el.createDiv({ cls: 'cp-panel-pie' });
    this.boton(pie, 'Cancelar', 'Cancelar', () => this.cerrar());
    this.boton(pie, 'Guardar', 'Guardar', () => this.guardar(), 'mod-cta');
    this.iniciar();
  }

  protected enfocar(): void {
    this.entradas[0]?.focus({ preventScroll: true });
    this.entradas[0]?.select();
  }

  protected tecla(e: KeyboardEvent): boolean {
    // Enter sobre «Cancelar» o «Guardar» hace lo de ese botón.
    if (e.key !== 'Enter' || (e.target as HTMLElement | null)?.tagName === 'BUTTON') return false;
    this.guardar();
    return true;
  }

  private guardar() {
    const valores = this.entradas.map((i) => i.value);
    this.terminar(() => this.o.alGuardar(valores));
  }
}

// ---------- Descripción técnica ----------

const GRUPOS: { clave: 'lente' | 'movimiento' | 'angulo'; nombre: string; lista: keyof ListasTecnicas }[] = [
  { clave: 'lente', nombre: 'Lente', lista: 'lentes' },
  { clave: 'movimiento', nombre: 'Movimiento', lista: 'movimientos' },
  { clave: 'angulo', nombre: 'Ángulo', lista: 'angulos' },
];

/** Lente, movimiento y ángulo, uno de cada grupo. Teclado: Tab entre grupos, flechas dentro, Espacio marca, Enter aplica. */
export class PanelTecnica extends Panel {
  private vista!: HTMLElement;
  private grupos: HTMLElement[] = [];

  constructor(
    ancla: HTMLElement,
    private listas: ListasTecnicas,
    private t: Tecnica,
    private alAplicar: (t: Tecnica) => void,
  ) {
    super(ancla, 'cp-tecnica', 'Descripción técnica');
    this.el.createDiv({ cls: 'cp-panel-titulo', text: 'Descripción técnica' });
    for (const g of GRUPOS) {
      const fila = this.el.createDiv({ cls: 'cp-tec-grupo' });
      fila.createDiv({ cls: 'cp-tec-nombre', text: g.nombre });
      const chips = fila.createDiv({ cls: 'cp-tec-chips', attr: { role: 'radiogroup', 'aria-label': g.nombre } });
      this.grupos.push(chips);
      this.pintarGrupo(g, chips);
    }
    this.vista = this.el.createDiv({ cls: 'cp-tec-vista', attr: { 'aria-live': 'polite' } });
    this.pintarVista();
    const pie = this.el.createDiv({ cls: 'cp-panel-pie' });
    this.botonAMano(pie);
    this.boton(pie, 'Aplicar', 'Escribir en la celda', () => this.terminar(() => this.alAplicar(this.t)), 'mod-cta');
    this.iniciar();
  }

  protected enfocar(): void {
    this.grupos[0]?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }

  private pintarGrupo(g: (typeof GRUPOS)[number], chips: HTMLElement) {
    const actual = this.t[g.clave];
    const opciones = this.listas[g.lista].slice();
    // Un valor que no está en la lista (un lente de 40 mm) también se ve, para no perderlo.
    if (actual && !opciones.includes(actual)) opciones.unshift(actual);
    const foco = chips.contains(this.doc.activeElement) ? (this.doc.activeElement as HTMLElement).dataset.valor : undefined;
    chips.empty();
    const conFoco = foco ?? actual ?? opciones[0];
    for (const v of opciones) {
      const b = chips.createEl('button', {
        text: v,
        cls: 'cp-chip' + (v === actual ? ' is-elegido' : ''),
        attr: { type: 'button', role: 'radio', 'aria-checked': String(v === actual), tabindex: v === conFoco ? '0' : '-1', 'data-valor': v },
      });
      b.addEventListener('click', () => this.marcar(g, v));
    }
    if (foco) chips.querySelector<HTMLElement>(`[data-valor="${CSS.escape(foco)}"]`)?.focus({ preventScroll: true });
  }

  /** Marca el valor; si ya estaba marcado, lo quita. */
  private marcar(g: (typeof GRUPOS)[number], v: string) {
    this.t = { ...this.t, [g.clave]: this.t[g.clave] === v ? undefined : v };
    this.pintarGrupo(g, this.grupos[GRUPOS.indexOf(g)]);
    this.pintarVista();
  }

  private pintarVista() {
    this.vista.setText(escribirTecnica(this.t));
  }

  protected tecla(e: KeyboardEvent): boolean {
    const objetivo = e.target as HTMLElement;
    const k = this.grupos.findIndex((c) => c.contains(objetivo));
    if (e.key === 'Enter') {
      this.terminar(() => this.alAplicar(this.t));
      return true;
    }
    if (k < 0) return false;
    const g = GRUPOS[k];
    if (e.key === ' ') {
      const v = objetivo.dataset.valor;
      if (v) this.marcar(g, v);
      return true;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return false;
    const chips = Array.from(this.grupos[k].querySelectorAll<HTMLElement>('.cp-chip'));
    const i = chips.indexOf(objetivo);
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length;
    chips.forEach((c, n) => (c.tabIndex = n === j ? 0 : -1));
    chips[j]?.focus({ preventScroll: true });
    return true;
  }
}
