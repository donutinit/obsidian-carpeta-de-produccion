import type { Vineta } from '../../motor';
import type { CampoCelda } from '../storyboard';

export interface AccionesVineta {
  editar(campo: CampoCelda, ancla: HTMLElement): void;
  /** Si está, la viñeta todavía no tiene dibujo: aparece «Dibujar». */
  dibujar?: () => void;
}

const COLUMNAS: [CampoCelda, string][] = [
  ['plano', 'Plano'],
  ['lente', 'Lente'],
  ['angulo', 'Ángulo'],
  ['movimiento', 'Movimiento'],
  ['accion', 'Acción'],
  ['sonido', 'Sonido y diálogo'],
];

/** Los datos de una viñeta, leídos del guion técnico. Cada celda abre su panel y escribe en el guion técnico. */
export function renderVineta(padre: HTMLElement, id: string, v: Vineta | null, acciones?: AccionesVineta): void {
  const caja = padre.createDiv({ cls: 'cp-vineta' });
  if (!v) {
    caja.createDiv({ cls: 'cp-msg', text: id ? `${id} ya no está en el guion técnico.` : 'Escribe adentro del bloque el número de la viñeta, por ejemplo «E1 · P1».' });
    return;
  }
  if (acciones?.dibujar) {
    const dibujar = acciones.dibujar;
    const b = caja.createEl('button', { cls: 'cp-vineta-dibujar', text: 'Dibujar', attr: { type: 'button', 'aria-label': `Dibujar la viñeta ${v.id}` } });
    b.addEventListener('click', () => dibujar());
  }
  const tabla = caja.createEl('table', { cls: 'cp-table cp-vineta-tabla' });
  const cab = tabla.createEl('thead').createEl('tr');
  for (const [, nombre] of COLUMNAS) cab.createEl('th', { text: nombre });
  const fila = tabla.createEl('tbody').createEl('tr');
  for (const [campo, nombre] of COLUMNAS) {
    const td = fila.createEl('td');
    const lineas = campo === 'sonido' ? [v.dialogo, v.sonido].filter(Boolean) : [v[campo]].filter(Boolean);
    const destino = acciones ? td.createEl('button', { cls: 'cp-vineta-valor', attr: { type: 'button', title: `Cambiar ${nombre.toLowerCase()} en el guion técnico` } }) : td;
    if (!lineas.length) destino.createSpan({ cls: 'cp-empty', text: '—' });
    lineas.forEach((l, k) => {
      if (k) destino.createEl('br');
      destino.appendText(l);
    });
    if (acciones && destino instanceof HTMLButtonElement) destino.addEventListener('click', () => acciones.editar(campo, destino));
  }
}

/** El resumen arriba del storyboard, con el botón para armarlo o ponerlo al día. */
export function renderStoryboard(
  padre: HTMLElement,
  e: { planos: number; armadas: number; conDibujo: number; faltan: number; huerfanas: number },
  armar: () => void,
): void {
  const caja = padre.createDiv({ cls: 'cp-storyboard' });
  if (!e.planos) {
    caja.createDiv({ cls: 'cp-msg', text: 'El guion técnico todavía no tiene planos: filas con su Escena y su N. de plano.' });
    return;
  }
  const partes = [`${e.planos} planos en el guion técnico`, `${e.armadas} viñetas armadas`, `${e.conDibujo} con dibujo`];
  if (e.huerfanas) partes.push(`${e.huerfanas} que ya no están`);
  caja.createSpan({ cls: 'cp-storyboard-resumen', text: partes.join(' · ') });
  const pendiente = e.armadas < e.planos;
  const b = caja.createEl('button', { cls: pendiente ? 'mod-cta' : '', text: e.armadas ? 'Actualizar storyboard' : 'Armar storyboard', attr: { type: 'button' } });
  b.addEventListener('click', () => armar());
}
