import { Notice } from 'obsidian';
import { formatearMinutos, timingMarkdown, type Timing } from '../../motor';
import { mensaje, SIN_ESCENAS } from './papel';

/** La tabla de «04 - Timing», con el renglón de total y un botón para copiarla como tabla Markdown. */
export function renderTiming(padre: HTMLElement, t: Timing): void {
  if (!t.filas.length) return mensaje(padre, SIN_ESCENAS);
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing' });
  const cab = caja.createDiv({ cls: 'cp-timing-cab' });
  cab.createEl('h3', { text: 'Timing' });
  const copiar = cab.createEl('button', { text: 'Copiar como tabla', attr: { type: 'button', 'aria-label': 'Copiar como tabla: timing' } });
  copiar.addEventListener('click', () => {
    navigator.clipboard.writeText(timingMarkdown(t)).then(
      () => new Notice('Timing copiado como tabla Markdown.'),
      () => new Notice('No se pudo copiar el timing.'),
    );
  });
  const tabla = caja.createEl('table', { cls: 'cp-table' });
  const tr = tabla.createEl('thead').createEl('tr');
  const numericas = new Set([0, 3, 4, 5, 6, 7]);
  ['Esc.', 'Set', 'Acciones', 'Pág.', 'Octavos', 'Planos', 'Tiempo aprox.', 'Acumulado'].forEach((c, i) => tr.createEl('th', { text: c, cls: numericas.has(i) ? 'cp-num' : '' }));
  const cuerpo = tabla.createEl('tbody');
  for (const f of t.filas) {
    const r = cuerpo.createEl('tr');
    const celdas = [f.escena, f.set, f.acciones, f.paginas, f.octavos, f.planos === null ? '—' : String(f.planos), (f.estimado ? '≈ ' : '') + formatearMinutos(f.segundos), formatearMinutos(f.acumulado)];
    celdas.forEach((x, i) => r.createEl('td', { text: x || '—', cls: numericas.has(i) ? 'cp-num' : '' }));
  }
  const pie = tabla.createEl('tfoot').createEl('tr');
  const total = [
    `${t.total.escenas} escenas`,
    'Total',
    '',
    String(t.total.paginas),
    `${t.total.octavos}/8`,
    t.total.planos === null ? '—' : String(t.total.planos),
    formatearMinutos(t.total.segundos),
    `${(t.total.segundos / 60).toFixed(1)} min`,
  ];
  total.forEach((x, i) => pie.createEl('td', { text: x, cls: numericas.has(i) ? 'cp-num' : '' }));
  if (t.filas.some((f) => f.estimado))
    caja.createDiv({
      cls: 'cp-timing-nota',
      text: t.total.planos === null
        ? '≈ Tiempo estimado con el texto del guion. Con un guion técnico en el proyecto, los planos y su duración salen de ahí.'
        : '≈ Tiempo estimado con el texto del guion: esas escenas todavía no tienen duraciones en el guion técnico.',
    });
}
