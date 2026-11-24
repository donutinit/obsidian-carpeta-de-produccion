import { Modal, SuggestModal, type App, type Plugin, type TFile } from 'obsidian';
import { construir, leerReglas, listaReparto } from '../motor';
import { preferencias } from './ajustes';
import { textoDe } from './cambios';
import { guionActivo } from './comandos-produccion';
import { ModalBuscar } from './buscar';
import { construirDe } from './guion';
import { exportarSides } from './pdf';
import { buscarProyecto, leerConfigProyecto, propiedades } from './proyecto';
import { renderRequisitos } from './render/requisitos';
import { abrirTarjetas } from './tarjetas';
import { correr, type Quizas } from './correr';

/** Las restricciones del proyecto (propiedades de `00 - Proyecto.md`). */
export function reglasDe(app: App, guion: TFile) {
  const p = buscarProyecto(app, guion);
  return leerReglas(p ? propiedades(app, p) : {});
}

class ModalRequisitos extends Modal {
  constructor(
    app: App,
    private guion: TFile,
  ) {
    super(app);
  }
  async onOpen() {
    this.modalEl.addClass('cp-modal-ancho');
    renderRequisitos(this.contentEl, await construirDe(this.app, this.guion), reglasDe(this.app, this.guion));
  }
  onClose() {
    this.contentEl.empty();
  }
}

class ModalActor extends SuggestModal<string> {
  constructor(
    app: App,
    private nombres: string[],
    private alElegir: (n: string) => void,
  ) {
    super(app);
    this.setPlaceholder('¿Los sides de quién?');
  }
  getSuggestions(q: string) {
    return this.nombres.filter((n) => n.toLowerCase().includes(q.toLowerCase()));
  }
  renderSuggestion(n: string, el: HTMLElement) {
    el.setText(n);
  }
  onChooseSuggestion(n: string) {
    this.alElegir(n);
  }
}

export function registrarRevision(plugin: Plugin, guardar: () => Promise<void>): void {
  const app = plugin.app;
  const conGuion = (id: string, name: string, fn: (g: TFile) => Quizas) =>
    plugin.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const g = guionActivo(app);
        if (!g) return false;
        if (!checking) correr(fn(g));
        return true;
      },
    });
  conGuion('buscar-por-tipo', 'Buscar en el guion por tipo de párrafo', (g) => new ModalBuscar(app, g).open());
  conGuion('verificar-requisitos', 'Verificar requisitos del proyecto', (g) => new ModalRequisitos(app, g).open());
  conGuion('sides', 'Sides por actor (PDF)', async (g) => {
    const reparto = listaReparto(construir(await textoDe(app, g), leerConfigProyecto(app, g.path))).map((r) => r.nombre);
    new ModalActor(app, reparto, (n) => correr(exportarSides(app, plugin, g, n))).open();
  });
  plugin.addCommand({ id: 'abrir-tarjetas', name: 'Abrir tarjetas de escenas', callback: () => void abrirTarjetas(app) });
  for (const [id, nombre, clave] of [
    ['alternar-maquina', 'Alternar máquina de escribir', 'maquinaDeEscribir'],
    ['alternar-enfoque', 'Alternar modo enfoque', 'enfoque'],
  ] as const) {
    plugin.addCommand({
      id,
      name: nombre,
      callback: () => {
        preferencias.actual[clave] = !preferencias.actual[clave];
        void guardar();
      },
    });
  }
}
