import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import { CONFIG_POR_DEFECTO, CORRECCIONES_POR_DEFECTO, type Cronometraje, type OpcionesCorreccion } from '../motor';

/** Valores que se escriben en `00 - Proyecto.md` de cada proyecto nuevo. */
export interface ValoresProyectoNuevo {
  renglonesPorPagina: number;
  espacioAntesEncabezado: number;
  textoMas: string;
  textoContinua: string;
  conservarExtension: boolean;
  ultimaPaginaCompleta: boolean;
  cronometraje: Cronometraje;
}

/** Ajustes del plugin: preferencias personales y valores para proyectos nuevos. */
export interface Preferencias {
  numerosEscena: boolean;
  cortesPagina: boolean;
  autocompletado: boolean;
  correcciones: OpcionesCorreccion;
  nuevos: ValoresProyectoNuevo;
  /** Centra la línea del cursor al escribir. */
  maquinaDeEscribir: boolean;
  /** Atenúa todo menos el párrafo o bloque de diálogo del cursor. */
  enfoque: boolean;
  /** Nombre con el que se firman los comentarios. */
  autorComentarios: string;
  /** Pulsar una celda de fecha, escena, plano, movimiento, ángulo, lente o descripción técnica abre un panel (el nombre viene del calendario). */
  calendarioFechas: boolean;
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  numerosEscena: false,
  cortesPagina: true,
  autocompletado: true,
  maquinaDeEscribir: false,
  enfoque: false,
  autorComentarios: '',
  calendarioFechas: true,
  correcciones: { ...CORRECCIONES_POR_DEFECTO },
  nuevos: {
    renglonesPorPagina: CONFIG_POR_DEFECTO.renglonesPorPagina,
    espacioAntesEncabezado: CONFIG_POR_DEFECTO.espacioAntesEncabezado,
    textoMas: CONFIG_POR_DEFECTO.textoMas,
    textoContinua: CONFIG_POR_DEFECTO.textoContinua,
    conservarExtension: CONFIG_POR_DEFECTO.conservarExtension,
    ultimaPaginaCompleta: CONFIG_POR_DEFECTO.ultimaPaginaCompleta,
    cronometraje: CONFIG_POR_DEFECTO.cronometraje,
  },
};

/** Las preferencias vigentes; las extensiones del editor las leen de aquí. */
export const preferencias: { actual: Preferencias; alCambiar: (() => void)[] } = { actual: structuredClone(PREFERENCIAS_POR_DEFECTO), alCambiar: [] };

export function mezclarPreferencias(guardadas: unknown): Preferencias {
  const g = (guardadas ?? {}) as Partial<Preferencias>;
  const d = PREFERENCIAS_POR_DEFECTO;
  return {
    numerosEscena: typeof g.numerosEscena === 'boolean' ? g.numerosEscena : d.numerosEscena,
    cortesPagina: typeof g.cortesPagina === 'boolean' ? g.cortesPagina : d.cortesPagina,
    autocompletado: typeof g.autocompletado === 'boolean' ? g.autocompletado : d.autocompletado,
    correcciones: { ...d.correcciones, ...(g.correcciones ?? {}) },
    nuevos: { ...d.nuevos, ...(g.nuevos ?? {}) },
    maquinaDeEscribir: typeof g.maquinaDeEscribir === 'boolean' ? g.maquinaDeEscribir : d.maquinaDeEscribir,
    enfoque: typeof g.enfoque === 'boolean' ? g.enfoque : d.enfoque,
    autorComentarios: typeof g.autorComentarios === 'string' ? g.autorComentarios : d.autorComentarios,
    calendarioFechas: typeof g.calendarioFechas === 'boolean' ? g.calendarioFechas : d.calendarioFechas,
  };
}

/** Las propiedades de `00 - Proyecto.md` que salen de los valores para proyectos nuevos. */
export function propiedadesProyectoNuevo(v: ValoresProyectoNuevo): Record<string, string | number | boolean> {
  return {
    renglones_por_pagina: v.renglonesPorPagina,
    espacio_antes_encabezado: v.espacioAntesEncabezado,
    texto_mas: v.textoMas,
    texto_continua: v.textoContinua,
    conservar_extension: v.conservarExtension,
    ultima_pagina_completa: v.ultimaPaginaCompleta,
    cronometraje: v.cronometraje,
  };
}

interface ConAjustes extends Plugin {
  guardarPreferencias(): Promise<void>;
}

export class PestanaAjustes extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ConAjustes,
  ) {
    super(app, plugin);
  }

  display(): void {
    const el = this.containerEl;
    el.empty();
    const p = preferencias.actual;
    const guardar = () => void this.plugin.guardarPreferencias();
    const interruptor = (nombre: string, desc: string, leer: () => boolean, escribir: (v: boolean) => void) =>
      new Setting(el)
        .setName(nombre)
        .setDesc(desc)
        .addToggle((t) =>
          t.setValue(leer()).onChange((v) => {
            escribir(v);
            guardar();
          }),
        );

    new Setting(el).setName('Editor de guion').setHeading();
    interruptor('Marcas de corte de página', 'Una línea tenue con el número de página donde empieza cada página.', () => p.cortesPagina, (v) => (p.cortesPagina = v));
    interruptor('Números de escena', 'El número de cada escena a los dos lados del encabezado.', () => p.numerosEscena, (v) => (p.numerosEscena = v));
    interruptor('Autocompletado', 'Sugerencias de encabezado, personaje, extensión y transición.', () => p.autocompletado, (v) => (p.autocompletado = v));
    interruptor('Máquina de escribir', 'La línea del cursor se queda a media ventana mientras escribes.', () => p.maquinaDeEscribir, (v) => (p.maquinaDeEscribir = v));
    interruptor('Modo enfoque', 'Atenúa todo menos el párrafo o el bloque de diálogo donde escribes.', () => p.enfoque, (v) => (p.enfoque = v));
    new Setting(el)
      .setName('Firma de tus comentarios')
      .setDesc('El nombre con el que se guardan los comentarios y respuestas que escribes («Profe», tu nombre…).')
      .addText((t) =>
        t
          .setPlaceholder('Tu nombre')
          .setValue(p.autorComentarios)
          .onChange((v) => {
            p.autorComentarios = v.trim();
            guardar();
          }),
      );

    new Setting(el).setName('Documentos del proyecto').setHeading();
    interruptor(
      'Paneles en las tablas',
      'Pulsar una celda de fecha, escena, plano, movimiento, ángulo, lente o descripción técnica abre un panel para elegir el valor.',
      () => p.calendarioFechas,
      (v) => (p.calendarioFechas = v),
    );

    new Setting(el).setName('Correcciones al escribir').setHeading();
    interruptor('Mayúscula inicial', 'Al inicio de párrafo y después de punto (no en acotaciones).', () => p.correcciones.mayusculas, (v) => (p.correcciones.mayusculas = v));
    interruptor('Puntos suspensivos', '«...» se vuelve «…».', () => p.correcciones.puntos, (v) => (p.correcciones.puntos = v));
    interruptor('Comillas «»', 'La comilla recta abre « o cierra » según lo que va antes.', () => p.correcciones.comillas, (v) => (p.correcciones.comillas = v));
    interruptor('Sin dobles espacios', 'Ni espacio al inicio del párrafo ni dos seguidos.', () => p.correcciones.espacios, (v) => (p.correcciones.espacios = v));

    new Setting(el)
      .setName('Para proyectos nuevos')
      .setDesc('Se escriben en «00 - Proyecto.md» de cada proyecto nuevo. Un proyecto ya creado se cambia en sus propiedades.')
      .setHeading();
    const n = p.nuevos;
    new Setting(el).setName('Renglones por página').addDropdown((d) =>
      d
        .addOptions({ '54': '54', '55': '55', '56': '56' })
        .setValue(String(n.renglonesPorPagina))
        .onChange((v) => {
          n.renglonesPorPagina = Number(v);
          guardar();
        }),
    );
    new Setting(el).setName('Renglones antes del encabezado').addDropdown((d) =>
      d
        .addOptions({ '1': '1', '2': '2' })
        .setValue(String(n.espacioAntesEncabezado))
        .onChange((v) => {
          n.espacioAntesEncabezado = Number(v);
          guardar();
        }),
    );
    new Setting(el).setName('Textos de continuación').setDesc('Al partir un diálogo entre páginas.').addDropdown((d) =>
      d
        .addOptions({ ingles: "(MORE) y (CONT'D)", espanol: '(MÁS) y (CONT.)' })
        .setValue(n.textoMas === '(MÁS)' ? 'espanol' : 'ingles')
        .onChange((v) => {
          n.textoMas = v === 'espanol' ? '(MÁS)' : '(MORE)';
          n.textoContinua = v === 'espanol' ? '(CONT.)' : "(CONT'D)";
          guardar();
        }),
    );
    interruptor('Conservar la extensión al continuar', '«ANA (V.O.) (CONT\'D)» en vez de «ANA (CONT\'D)».', () => n.conservarExtension, (v) => (n.conservarExtension = v));
    interruptor('Contar la última página completa', 'Algunas escuelas cuentan 8/8 en la última página.', () => n.ultimaPaginaCompleta, (v) => (n.ultimaPaginaCompleta = v));
    new Setting(el).setName('Cronometraje').setDesc('Cómo se calcula la duración de cada escena.').addDropdown((d) =>
      d
        .addOptions({ pagina: 'Por página (1 página ≈ 1 minuto)', caracteres: 'Por caracteres (1350 por minuto)', tipo: 'Por tipo de párrafo' })
        .setValue(n.cronometraje)
        .onChange((v) => {
          n.cronometraje = v as Cronometraje;
          guardar();
        }),
    );
  }
}
