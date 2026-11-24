import { debounce, Modal, normalizePath, Notice, Setting, TFile, TFolder, type App, type Plugin } from 'obsidian';
import { analizar, contarPalabras } from '../motor';
import { textoDe } from './cambios';
import { guionActivo } from './comandos-produccion';
import { esGuion } from './proyecto';

/** Una sesión de escritura: de la primera edición a la última antes de 30 min sin actividad. */
export interface Sesion {
  ruta: string;
  inicio: number;
  fin: number;
  palabrasInicio: number;
  palabrasFin: number;
}

const PAUSA_MS = 30 * 60 * 1000;
const palabras = (t: string) => contarPalabras(analizar(t));

export const datosEscritura: { sesiones: Sesion[]; guardar: () => void } = { sesiones: [], guardar: () => undefined };

const abiertas = new Map<string, Sesion>();

/** Registra actividad en un guion: abre una sesión nueva tras 30 min sin actividad y lleva las palabras netas. */
function actividad(ruta: string, texto: string): void {
  const ahora = Date.now();
  let s = abiertas.get(ruta);
  if (s && ahora - s.fin > PAUSA_MS) {
    abiertas.delete(ruta);
    s = undefined;
  }
  if (!s) {
    const n = palabras(texto);
    s = { ruta, inicio: ahora, fin: ahora, palabrasInicio: n, palabrasFin: n };
    abiertas.set(ruta, s);
    datosEscritura.sesiones.push(s);
  }
  s.fin = ahora;
  s.palabrasFin = palabras(texto);
  datosEscritura.guardar();
}

const formatoMinSeg = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Sprint {
  ruta: string;
  fin: number;
  palabrasInicio: number;
  reloj: number;
}

class ModalSprint extends Modal {
  constructor(
    app: App,
    private alIniciar: (minutos: number) => void,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Sprint de escritura');
    let minutos = 25;
    new Setting(this.contentEl).setName('Minutos').addText((t) => {
      t.setValue('25').onChange((v) => (minutos = Math.max(1, Math.min(180, Number(v) || 25))));
      t.inputEl.type = 'number';
    });
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText('Empezar')
        .setCta()
        .onClick(() => {
          this.close();
          this.alIniciar(minutos);
        }),
    );
  }
  onClose() {
    this.contentEl.empty();
  }
}

function tablaSesiones(padre: HTMLElement, sesiones: Sesion[]): void {
  const validas = sesiones.filter((s) => s.fin - s.inicio >= 60 * 1000 || s.palabrasFin !== s.palabrasInicio);
  if (!validas.length) {
    padre.createDiv({ cls: 'cp-msg', text: 'Todavía no hay sesiones de escritura de este guion.' });
    return;
  }
  const t = padre.createEl('table', { cls: 'cp-table' });
  const cab = t.createEl('thead').createEl('tr');
  ['Fecha', 'De', 'A', 'Minutos', 'Palabras netas'].forEach((x) => cab.createEl('th', { text: x }));
  const cuerpo = t.createEl('tbody');
  let min = 0;
  let netas = 0;
  for (const s of validas) {
    const r = cuerpo.createEl('tr');
    const m = Math.round((s.fin - s.inicio) / 60000);
    const n = s.palabrasFin - s.palabrasInicio;
    min += m;
    netas += n;
    const d = new Date(s.inicio);
    [d.toLocaleDateString('es-MX'), d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), new Date(s.fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), String(m), String(n)].forEach((x, i) =>
      r.createEl('td', { text: x, cls: i >= 3 ? 'cp-num' : '' }),
    );
  }
  const pie = cuerpo.createEl('tr');
  ['Total', '', '', String(min), String(netas)].forEach((x, i) => pie.createEl('td', { text: x, cls: i >= 3 ? 'cp-num cp-b' : 'cp-b' }));
}

class ModalSesiones extends Modal {
  constructor(
    app: App,
    private ruta: string,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Sesiones de escritura');
    tablaSesiones(this.contentEl, datosEscritura.sesiones.filter((s) => s.ruta === this.ruta));
  }
  onClose() {
    this.contentEl.empty();
  }
}

async function guardarEnNota(app: App, guion: TFile): Promise<void> {
  const sesiones = datosEscritura.sesiones.filter((s) => s.ruta === guion.path && (s.fin - s.inicio >= 60000 || s.palabrasFin !== s.palabrasInicio));
  const dir = guion.parent && guion.parent.path !== '/' ? guion.parent.path + '/' : '';
  const ruta = normalizePath(`${dir}Sesiones de escritura.md`);
  const filas = sesiones.map((s) => {
    const d = new Date(s.inicio);
    return `| ${d.toLocaleDateString('es-MX')} | ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} | ${new Date(s.fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} | ${Math.round((s.fin - s.inicio) / 60000)} | ${s.palabrasFin - s.palabrasInicio} |`;
  });
  const total = sesiones.reduce((a, s) => a + s.palabrasFin - s.palabrasInicio, 0);
  const texto = `---\ngenerado: true\ncarpeta: sesiones\nguion: "[[${guion.basename}]]"\nsesiones: ${sesiones.length}\npalabras_netas: ${total}\n---\n# Sesiones de escritura\n\nGenerada desde [[${guion.basename}]]. Se vuelve a escribir con «Guardar sesiones de escritura en una nota».\n\n| Fecha | De | A | Minutos | Palabras netas |\n|---|---|---|---:|---:|\n${filas.join('\n')}\n`;
  const previa = app.vault.getAbstractFileByPath(ruta);
  if (previa instanceof TFile) {
    const actual = await app.vault.read(previa);
    if (!/^---\n[\s\S]*?\ngenerado:\s*true\b/.test(actual)) {
      new Notice(`«${ruta}» ya existe y no la generó el plugin; no la toqué.`);
      return;
    }
    await app.vault.modify(previa, texto);
  } else {
    if (dir && !(app.vault.getAbstractFileByPath(dir.slice(0, -1)) instanceof TFolder)) await app.vault.createFolder(dir.slice(0, -1));
    await app.vault.create(ruta, texto);
  }
  new Notice(`Sesiones guardadas en «${ruta}».`);
}

export function registrarEscritura(plugin: Plugin, cargadas: Sesion[], guardar: () => Promise<void>): void {
  const app = plugin.app;
  datosEscritura.sesiones = cargadas;
  datosEscritura.guardar = debounce(() => void guardar(), 5000, false);
  const registrar = debounce((ruta: string, texto: string) => actividad(ruta, texto), 3000, false);
  // Si el guion (o su carpeta) cambia de nombre, sus sesiones lo siguen.
  plugin.registerEvent(
    app.vault.on('rename', (f, viejo) => {
      const mover = (r: string) => (r === viejo ? f.path : r.startsWith(viejo + '/') ? f.path + r.slice(viejo.length) : r);
      let cambio = false;
      for (const s of datosEscritura.sesiones) {
        const n = mover(s.ruta);
        if (n !== s.ruta) {
          s.ruta = n;
          cambio = true;
        }
      }
      for (const [r, s] of [...abiertas]) {
        if (mover(r) !== r) {
          abiertas.delete(r);
          abiertas.set(mover(r), s);
        }
      }
      if (cambio) datosEscritura.guardar();
    }),
  );
  plugin.registerEvent(
    app.workspace.on('editor-change', (editor, info) => {
      const f = info?.file;
      if (f && esGuion(app, f)) registrar(f.path, editor.getValue());
    }),
  );

  // Sprint: un temporizador en la barra de estado con las palabras netas.
  const barra = plugin.addStatusBarItem();
  barra.addClass('cp-sprint');
  let sprint: Sprint | null = null;
  const parar = (aviso: boolean) => {
    if (!sprint) return;
    window.clearInterval(sprint.reloj);
    const s = sprint;
    sprint = null;
    barra.setText('');
    if (aviso) {
      const f = app.vault.getAbstractFileByPath(s.ruta);
      if (f instanceof TFile)
        void textoDe(app, f).then((t) => {
          const n = palabras(t) - s.palabrasInicio;
          new Notice(`¡Sprint terminado! ${n} ${Math.abs(n) === 1 ? 'palabra neta' : 'palabras netas'}.`, 10000);
        });
    }
  };
  plugin.register(() => parar(false));
  plugin.addCommand({
    id: 'iniciar-sprint',
    name: 'Iniciar sprint de escritura',
    checkCallback: (checking) => {
      const g = guionActivo(app);
      if (!g) return false;
      if (!checking)
        new ModalSprint(app, (minutos) => {
          parar(false);
          void textoDe(app, g).then((t) => {
            const inicio = palabras(t);
            const fin = Date.now() + minutos * 60000;
            const tic = async () => {
              if (!sprint) return;
              const resta = sprint.fin - Date.now();
              if (resta <= 0) return parar(true);
              const n = palabras(await textoDe(app, g)) - inicio;
              barra.setText(`⏱ ${formatoMinSeg(resta)} · ${n} ${Math.abs(n) === 1 ? 'palabra' : 'palabras'}`);
            };
            sprint = { ruta: g.path, fin, palabrasInicio: inicio, reloj: window.setInterval(() => void tic(), 1000) };
            void tic();
          });
        }).open();
      return true;
    },
  });
  plugin.addCommand({ id: 'detener-sprint', name: 'Detener sprint de escritura', checkCallback: (checking) => (sprint ? (checking || parar(true), true) : false) });
  plugin.addCommand({
    id: 'ver-sesiones',
    name: 'Ver sesiones de escritura',
    checkCallback: (checking) => {
      const g = guionActivo(app);
      if (!g) return false;
      if (!checking) new ModalSesiones(app, g.path).open();
      return true;
    },
  });
  plugin.addCommand({
    id: 'guardar-sesiones',
    name: 'Guardar sesiones de escritura en una nota',
    checkCallback: (checking) => {
      const g = guionActivo(app);
      if (!g) return false;
      if (!checking) void guardarEnNota(app, g);
      return true;
    },
  });
}
