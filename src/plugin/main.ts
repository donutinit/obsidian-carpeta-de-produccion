import { ocultasEditor } from './editor/ocultas';
import { anchoGuion } from './editor/ancho';
import { Plugin } from 'obsidian';
import { mezclarPreferencias, PestanaAjustes, preferencias } from './ajustes';
import { registrarBloques } from './bloques';
import { abrirNavegador, abrirPanelBreakdown, abrirVistaPrevia, registrarComandos } from './comandos';
import { marcasDePagina } from './editor/cortes';
import { seguidorCursor } from './editor/cursor';
import { formatoGuion } from './editor/formato';
import { Sugeridor } from './editor/sugeridor';
import { marcasEditor, teclasSubrayado } from './editor/subrayado';
import { teclasGuion } from './editor/teclas';
import { Navegador, VISTA_NAVEGADOR } from './navegador';
import { PanelBreakdown, VISTA_BREAKDOWN_ESCENA } from './panel-breakdown';
import { registrarComandosProduccion } from './comandos-produccion';
import { registrarEntrega } from './entrega';
import { registrarRevision } from './comandos-revision';
import { registrarComentarios } from './panel-comentarios';
import { registrarEscritura, type Sesion } from './escritura';
import { VistaTarjetas, VISTA_TARJETAS } from './tarjetas';
import { concentracion } from './editor/concentracion';
import { registrarPaneles } from './paneles';
import { registrarRevisionGuion } from './panel-revision';
import { registrarPersonajes } from './comandos-personajes';
import { registrarStoryboard } from './storyboard';
import { VISTA_GUION, VistaPrevia } from './vista-previa';

export default class CarpetaPlugin extends Plugin {
  sesiones: Sesion[] = [];

  async onload() {
    const datos = ((await this.loadData()) ?? {}) as { sesiones?: Sesion[] };
    preferencias.actual = mezclarPreferencias(datos);
    this.sesiones = Array.isArray(datos.sesiones) ? datos.sesiones : [];
    this.addSettingTab(new PestanaAjustes(this.app, this));
    this.registerView(VISTA_GUION, (leaf) => new VistaPrevia(leaf));
    this.registerView(VISTA_NAVEGADOR, (leaf) => new Navegador(leaf));
    this.registerView(VISTA_BREAKDOWN_ESCENA, (leaf) => new PanelBreakdown(leaf));
    registrarBloques(this);
    registrarComandos(this);
    registrarComandosProduccion(this);
    registrarEntrega(this);
    registrarComentarios(this);
    registrarRevision(this, () => this.guardarPreferencias());
    registrarEscritura(this, this.sesiones, () => this.guardarDatos());
    registrarPaneles(this);
    registrarRevisionGuion(this);
    registrarPersonajes(this);
    registrarStoryboard(this);
    this.registerView(VISTA_TARJETAS, (leaf) => new VistaTarjetas(leaf));
    this.addRibbonIcon('clapperboard', 'Vista previa del guion', () => void abrirVistaPrevia(this.app));
    this.addRibbonIcon('list-ordered', 'Navegador de escenas', () => void abrirNavegador(this.app));
    this.addRibbonIcon('clipboard-list', 'Breakdown de la escena', () => void abrirPanelBreakdown(this.app));
    this.registerEditorExtension([teclasGuion(), formatoGuion, marcasEditor, teclasSubrayado, marcasDePagina, seguidorCursor, concentracion, ocultasEditor, anchoGuion]);
    this.registerEditorSuggest(new Sugeridor(this.app));
  }

  /** Solo escribe data.json (las sesiones se guardan seguido: no deben redibujar los editores). */
  async guardarDatos(): Promise<void> {
    await this.saveData({ ...preferencias.actual, sesiones: this.sesiones });
  }

  async guardarPreferencias(): Promise<void> {
    await this.saveData({ ...preferencias.actual, sesiones: this.sesiones });
    for (const f of preferencias.alCambiar) f();
    this.app.workspace.updateOptions();
  }
}
