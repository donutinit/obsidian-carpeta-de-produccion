import { MarkdownView, Modal, type App, type TFile } from 'obsidian';
import { buscarEnGuion, type ResultadoBusqueda, type TipoElemento } from '../motor';
import { textoDe } from './cambios';

const FILTROS: [string, TipoElemento[] | undefined][] = [
  ['Todo', undefined],
  ['Encabezados', ['encabezado']],
  ['Acción', ['accion']],
  ['Personajes', ['personaje']],
  ['Diálogos', ['dialogo', 'letra']],
  ['Acotaciones', ['acotacion']],
  ['Transiciones', ['transicion']],
  ['Planos', ['plano']],
];
const NOMBRE_TIPO: Partial<Record<TipoElemento, string>> = { encabezado: 'Encabezado', accion: 'Acción', personaje: 'Personaje', dialogo: 'Diálogo', letra: 'Letra', acotacion: 'Acotación', transicion: 'Transición', plano: 'Plano', centrado: 'Centrado' };

/** Buscar en el guion por tipo de párrafo: sin acentos ni mayúsculas; clic salta a la línea. */
export class ModalBuscar extends Modal {
  private filtro: TipoElemento[] | undefined;
  private consulta = '';
  private texto = '';

  constructor(
    app: App,
    private guion: TFile,
  ) {
    super(app);
  }

  async onOpen() {
    this.titleEl.setText('Buscar en el guion');
    this.texto = await textoDe(this.app, this.guion);
    const chips = this.contentEl.createDiv({ cls: 'cp-bus-filtros' });
    const botones = FILTROS.map(([nombre, tipos]) => {
      const b = chips.createEl('button', { text: nombre });
      b.onclick = () => {
        this.filtro = tipos;
        botones.forEach((x) => x.removeClass('mod-cta'));
        b.addClass('mod-cta');
        this.dibujar(lista);
      };
      return b;
    });
    botones[0].addClass('mod-cta');
    const input = this.contentEl.createEl('input', { type: 'text', cls: 'cp-bus-input', attr: { placeholder: 'Texto a buscar…' } });
    const lista = this.contentEl.createDiv({ cls: 'cp-bus-lista' });
    input.oninput = () => {
      this.consulta = input.value;
      this.dibujar(lista);
    };
    window.setTimeout(() => input.focus(), 30);
    this.dibujar(lista);
  }

  private dibujar(lista: HTMLElement) {
    lista.empty();
    if (!this.consulta.trim() && !this.filtro) {
      lista.createDiv({ cls: 'cp-msg', text: 'Escribe algo o elige un tipo de párrafo.' });
      return;
    }
    const r = buscarEnGuion(this.texto, this.consulta, this.filtro);
    lista.createDiv({ cls: 'cp-bus-cuenta', text: `${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}` });
    for (const x of r.slice(0, 300)) {
      const fila = lista.createDiv({ cls: 'cp-bus-fila' });
      fila.createSpan({ cls: 'cp-bus-tipo', text: NOMBRE_TIPO[x.tipo] ?? x.tipo });
      fila.createSpan({ text: x.texto });
      fila.onclick = () => this.ir(x);
    }
  }

  private ir(x: ResultadoBusqueda) {
    this.close();
    const hoja = this.app.workspace.getLeavesOfType('markdown').find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.guion.path);
    if (!hoja || !(hoja.view instanceof MarkdownView)) {
      void this.app.workspace.getLeaf('tab').openFile(this.guion, { eState: { line: x.linea } });
      return;
    }
    this.app.workspace.setActiveLeaf(hoja, { focus: true });
    hoja.view.editor.setCursor({ line: x.linea, ch: 0 });
    hoja.view.editor.scrollIntoView({ from: { line: x.linea, ch: 0 }, to: { line: x.linea, ch: 0 } }, true);
  }

  onClose() {
    this.contentEl.empty();
  }
}
