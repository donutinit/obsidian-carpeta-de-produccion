import { debounce, MarkdownRenderChild, TFile, type Plugin } from 'obsidian';
import { construirDe } from './guion';
import { buscarGuion, buscarProyecto } from './proyecto';
import { ordenReparto } from './generar';
import { renderBreakdown } from './render/breakdown';
import { renderElementos, renderLocaciones, renderReparto } from './render/listas';
import { renderRequisitos } from './render/requisitos';
import { reglasDe } from './comandos-revision';
import { renderHojaOctavos, renderTablaOctavos } from './render/octavos';
import { renderGuion, tituloDe } from './render/papel';

type Tipo = 'guion' | 'octavos' | 'breakdown' | 'reparto' | 'locaciones' | 'elementos' | 'requisitos';

class BloqueCarpeta extends MarkdownRenderChild {
  private guion: TFile | null = null;
  private pendiente = debounce(() => void this.render(), 400, true);

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
    void this.render();
    this.registerEvent(
      app.vault.on('modify', (f) => {
        if (this.guion && f.path === this.guion.path) this.pendiente();
      }),
    );
    this.registerEvent(
      app.metadataCache.on('changed', (f) => {
        if (!this.guion || (f instanceof TFile && buscarProyecto(app, this.guion)?.path === f.path)) this.pendiente();
      }),
    );
    this.registerEvent(
      app.metadataCache.on('resolved', () => {
        if (!this.guion) this.pendiente();
      }),
    );
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
    else renderBreakdown(el, g);
  }
}

export function registrarBloques(plugin: Plugin): void {
  for (const tipo of ['guion', 'octavos', 'breakdown', 'reparto', 'locaciones', 'elementos', 'requisitos'] as const) {
    plugin.registerMarkdownCodeBlockProcessor(`carpeta-${tipo}`, (fuente, el, ctx) => {
      ctx.addChild(new BloqueCarpeta(el, plugin, ctx.sourcePath, tipo, fuente));
    });
  }
}
