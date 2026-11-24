import { debounce, MarkdownRenderChild, TFile, type Plugin } from 'obsidian';
import { construirDe } from './guion';
import { buscarGuion, buscarProyecto, notasDelProyecto, propiedades } from './proyecto';
import { ordenReparto } from './generar';
import { renderBreakdown } from './render/breakdown';
import { renderElementos, renderLocaciones, renderReparto } from './render/listas';
import { renderRequisitos } from './render/requisitos';
import { reglasDe } from './comandos-revision';
import { renderHojaOctavos, renderTablaOctavos } from './render/octavos';
import { renderGuion, tituloDe } from './render/papel';
import { renderTiming } from './render/timing';
import { beatsDeEscena, nombrePropio, personajesDelGuion, creditos, cuesMusicales, escenasDePersonaje, listaReparto, vestuarioPorPersonaje, armarLlamado, armarPlan, armarTiming, datosDeDias, diasDelPlan, OPCIONES_PLAN, planosCompletos, planosDeTecnico, type OpcionesPlan, type PlanoTecnico } from '../motor';
import { renderLlamado, renderPlan } from './render/plan';
import { renderBeats, renderCreditos, renderCues, renderPersonaje, renderVestuario } from './render/personajes';

type Tipo = 'guion' | 'octavos' | 'breakdown' | 'reparto' | 'locaciones' | 'elementos' | 'requisitos' | 'timing' | 'plan' | 'llamado' | 'beats' | 'personaje' | 'vestuario' | 'cues' | 'creditos';

class BloqueCarpeta extends MarkdownRenderChild {
  private guion: TFile | null = null;
  private pendiente = debounce(() => void this.dibujar(), 400, true);

  constructor(
    el: HTMLElement,
    private plugin: Plugin,
    private rutaNota: string,
    private tipo: Tipo,
    private opciones: string,
  ) {
    super(el);
  }

  onload() {
    const app = this.plugin.app;
    void this.dibujar();
    this.registerEvent(
      app.vault.on('modify', (f) => {
        if (!this.guion) return;
        // El timing, el plan y el llamado también dependen de otras notas del proyecto.
        const otras = this.tipo === 'timing' ? ['guion-tecnico'] : this.tipo === 'plan' || this.tipo === 'llamado' ? ['guion-tecnico', 'shooting-list'] : [];
        const depende = f.path === this.guion.path || (otras.length > 0 && (f.path === this.rutaNota || otras.some((c) => notasDelProyecto(app, this.guion!, c).some((n) => n.path === f.path))));
        if (depende) this.pendiente();
      }),
    );
    this.registerEvent(
      app.metadataCache.on('changed', (f) => {
        if (!this.guion || (f instanceof TFile && buscarProyecto(app, this.guion)?.path === f.path)) this.pendiente();
        // Los créditos y la ficha también dependen de las fichas de personaje.
        else if ((this.tipo === 'creditos' || this.tipo === 'personaje') && f instanceof TFile && f.path.split('/').some((p) => p.toLowerCase() === 'personajes')) this.pendiente();
      }),
    );
    this.registerEvent(
      app.metadataCache.on('resolved', () => {
        if (!this.guion) this.pendiente();
      }),
    );
  }

  /** Dibuja el bloque; si algo falla, lo dice en el bloque en vez de dejarlo en blanco. */
  async dibujar(): Promise<void> {
    try {
      await this.render();
    } catch (e) {
      console.error('Carpeta de producción:', e);
      this.containerEl.empty();
      this.containerEl.createDiv({ cls: 'cp-msg', text: 'No se pudo dibujar este bloque: ' + (e instanceof Error ? e.message : String(e)) });
    }
  }

  async render() {
    const app = this.plugin.app;
    this.guion = buscarGuion(app, this.rutaNota);
    const el = this.containerEl;
    el.empty();
    el.addClass('carpeta-block');
    if (!this.guion) {
      el.createDiv({ cls: 'cp-msg', text: 'No encontré el guion. En esta carpeta tiene que haber una nota con «carpeta: guion» en sus propiedades.' });
      return;
    }
    const g = await construirDe(app, this.guion);
    const o = this.opciones;
    if (this.tipo === 'guion') renderGuion(el, g, { subrayado: /subrayado/.test(o), portada: !/sin portada/.test(o) });
    else if (this.tipo === 'octavos') {
      const tabla = /tabla/.test(o);
      const hojas = /hojas/.test(o);
      if (tabla || !hojas) renderTablaOctavos(el, g);
      if (hojas || !tabla) renderHojaOctavos(el, g, tituloDe(g));
    } else if (this.tipo === 'reparto') renderReparto(el, g, ordenReparto(app, this.guion));
    else if (this.tipo === 'locaciones') renderLocaciones(el, g);
    else if (this.tipo === 'requisitos') renderRequisitos(el, g, reglasDe(app, this.guion));
    else if (this.tipo === 'elementos') renderElementos(el, g, o.trim().split(/\s+/)[0] || undefined);
    else if (this.tipo === 'timing') {
      const tecnicos = notasDelProyecto(app, this.guion, 'guion-tecnico');
      let planos: PlanoTecnico[] | null = null;
      for (const n of tecnicos) planos = [...(planos ?? []), ...planosDeTecnico(await app.vault.cachedRead(n))];
      renderTiming(el, armarTiming(g, planos));
    } else if (this.tipo === 'plan' || this.tipo === 'llamado') {
      const leer = async (c: string) => Promise.all(notasDelProyecto(app, this.guion!, c).map((n) => app.vault.cachedRead(n)));
      const planos = (await leer('guion-tecnico')).flatMap(planosCompletos);
      const host = app.vault.getAbstractFileByPath(this.rutaNota);
      const propia = host instanceof TFile ? await app.vault.cachedRead(host) : '';
      // Los días y sus escenas salen de la shooting list; la fecha y la primera toma, de esta nota si las trae.
      const lista = this.tipo === 'plan' ? propia : (await leer('shooting-list')).join('\n\n');
      const datosLista = datosDeDias(lista);
      const datosPropios = datosDeDias(propia);
      const soloDia = /d[ií]a\s+(\d+)/i.exec(o)?.[1];
      const dias = diasDelPlan(lista).filter((d) => !soloDia || d.dia === Number(soloDia));
      const op = opcionesPlan(propiedades(app, buscarProyecto(app, this.guion) ?? this.guion));
      const planes = dias.map((d) => armarPlan(g, d, { ...datosLista.get(d.dia), ...datosPropios.get(d.dia) }, planos, op));
      if (this.tipo === 'plan') renderPlan(el, planes);
      else renderLlamado(el, planes.map((plan) => ({ plan, llamado: armarLlamado(g, plan) })));
    } else if (this.tipo === 'beats') {
      const n = /escena\s+(\S+)/i.exec(o)?.[1];
      const ks = g.doc.escenas.map((_, k) => k).filter((k) => !n || g.doc.escenas[k].numero.toUpperCase() === n.toUpperCase());
      renderBeats(el, ks.map((k) => ({ titulo: `Escena ${g.doc.escenas[k].numero}. ${g.doc.escenas[k].encabezado}`, beats: beatsDeEscena(g, k) })));
    } else if (this.tipo === 'personaje') {
      const host = app.vault.getAbstractFileByPath(this.rutaNota);
      const prop = host instanceof TFile ? propiedades(app, host).personaje : undefined;
      const nombre = typeof prop === 'string' && prop.trim() ? prop.trim() : host instanceof TFile ? host.basename : '';
      renderPersonaje(el, nombrePropio(nombre), escenasDePersonaje(g, nombre));
    } else if (this.tipo === 'vestuario') renderVestuario(el, vestuarioPorPersonaje(g));
    else if (this.tipo === 'cues') renderCues(el, cuesMusicales(g));
    else if (this.tipo === 'creditos') {
      const proyecto = buscarProyecto(app, this.guion);
      const eq = proyecto ? propiedades(app, proyecto).equipo : undefined;
      const equipo = Array.isArray(eq) ? eq.map(String) : typeof eq === 'string' ? eq.split('\n') : [];
      const dir = this.guion.parent?.path ?? '';
      const fichas = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith((dir && dir !== '/' ? dir + '/' : '') + 'Personajes/'));
      const actorDe = (p: string) => {
        const f = fichas.find((x) => {
          const pr = propiedades(app, x).personaje;
          return x.basename.toLowerCase() === p.toLowerCase() || (typeof pr === 'string' && pr.toLowerCase() === p.toLowerCase());
        });
        const a = f ? propiedades(app, f).actor : undefined;
        // «[[Kaia Betancourt]]» o «[[Kaia|Kaia B.]]» se leen como el nombre; una lista de dos actores, con «y».
        const texto = (x: unknown) => (typeof x === 'string' ? x.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, r: string, alias?: string) => alias ?? r).trim() : '');
        return Array.isArray(a) ? a.map(texto).filter(Boolean).join(' y ') : texto(a);
      };
      // El orden del reparto (orden_reparto) y, al final, quien solo habla fuera de cuadro.
      const nombres = listaReparto(g, ordenReparto(app, this.guion)).map((r) => r.nombre);
      for (const n of personajesDelGuion(g)) if (!nombres.some((x) => x.toLowerCase() === n.toLowerCase())) nombres.push(n);
      renderCreditos(el, creditos(equipo, nombres.map((n) => ({ personaje: n, actor: actorDe(n) }))));
    }
    else renderBreakdown(el, g);
  }
}

/** Minutos por plano y por octavo, y la comida, de las propiedades del proyecto. */
function opcionesPlan(p: Record<string, unknown>): OpcionesPlan {
  const n = (v: unknown, d: number, cero = false) => {
    const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(x) && (x > 0 || (cero && x === 0)) ? x : d;
  };
  return {
    minutosPorPlano: n(p.minutos_por_plano, OPCIONES_PLAN.minutosPorPlano),
    minutosPorOctavo: n(p.minutos_por_octavo, OPCIONES_PLAN.minutosPorOctavo),
    // `minutos_comida: 0` quita la comida.
    minutosComida: n(p.minutos_comida, OPCIONES_PLAN.minutosComida, true),
    comidaTras: n(p.comida_tras_horas, OPCIONES_PLAN.comidaTras / 60) * 60,
  };
}

export function registrarBloques(plugin: Plugin): void {
  for (const tipo of ['guion', 'octavos', 'breakdown', 'reparto', 'locaciones', 'elementos', 'requisitos', 'timing', 'plan', 'llamado', 'beats', 'personaje', 'vestuario', 'cues', 'creditos'] as const) {
    plugin.registerMarkdownCodeBlockProcessor(`carpeta-${tipo}`, (fuente, el, ctx) => {
      ctx.addChild(new BloqueCarpeta(el, plugin, ctx.sourcePath, tipo, fuente));
    });
  }
}
