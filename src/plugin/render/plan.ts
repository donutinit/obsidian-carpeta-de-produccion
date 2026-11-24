import { Notice } from 'obsidian';
import { horaTexto, tablaMarkdown, type Llamado, type PlanDia } from '../../motor';

/** Una tabla con su botón «Copiar como tabla». */
export function tablaConCopia(padre: HTMLElement, titulo: string, cabeza: string[], filas: string[][], numericas: number[] = []): HTMLTableElement {
  const cab = padre.createDiv({ cls: 'cp-timing-cab' });
  cab.createEl('h4', { text: titulo });
  const copiar = cab.createEl('button', { text: 'Copiar como tabla', attr: { type: 'button', 'aria-label': `Copiar como tabla: ${titulo}` } });
  copiar.addEventListener('click', () => {
    navigator.clipboard.writeText(tablaMarkdown(cabeza, filas)).then(
      () => new Notice(`«${titulo}» copiado como tabla Markdown.`),
      () => new Notice('No se pudo copiar.'),
    );
  });
  const t = padre.createEl('table', { cls: 'cp-table' });
  const tr = t.createEl('thead').createEl('tr');
  cabeza.forEach((c, i) => tr.createEl('th', { text: c, cls: numericas.includes(i) ? 'cp-num' : '' }));
  const cuerpo = t.createEl('tbody');
  for (const f of filas) {
    const r = cuerpo.createEl('tr');
    f.forEach((x, i) => r.createEl('td', { text: x || '—', cls: numericas.includes(i) ? 'cp-num' : '' }));
  }
  return t;
}

function encabezadoDia(padre: HTMLElement, plan: PlanDia): void {
  padre.createEl('h3', { text: `Día ${plan.dia}${plan.fecha ? ' · ' + plan.fecha : ''}` });
  padre.createDiv({
    cls: 'cp-plan-datos',
    text: `Llamado de crew ${horaTexto(plan.llamadoCrew)} · Primera toma ${horaTexto(plan.primeraToma)} · Fin estimado ${horaTexto(plan.fin)}`,
  });
  if (plan.faltantes.length)
    padre.createDiv({ cls: 'cp-msg', text: `${plan.faltantes.length === 1 ? 'La escena' : 'Las escenas'} ${plan.faltantes.join(', ')} no ${plan.faltantes.length === 1 ? 'está' : 'están'} en el guion.` });
  if (plan.repetidas.length)
    padre.createDiv({ cls: 'cp-msg', text: `${plan.repetidas.length === 1 ? 'La escena' : 'Las escenas'} ${plan.repetidas.join(', ')} ${plan.repetidas.length === 1 ? 'aparece' : 'aparecen'} dos veces en el día: se programa una sola vez.` });
}

/** Los planos del día en orden de rodaje, con la hora estimada de cada uno. */
export function renderPlan(padre: HTMLElement, planes: PlanDia[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!planes.length) {
    caja.createDiv({ cls: 'cp-msg', text: 'No hay días en el plan. En la tabla «Orden de rodaje» escribe el día y la escena (columnas «Día» y «Esc.»).' });
    return;
  }
  for (const p of planes) {
    encabezadoDia(caja, p);
    const filas = p.filas.map((f) =>
      f.comida
        ? [horaTexto(f.hora), String(f.minutos), '', '', 'Comida', '', '', '', '', '', '']
        : [horaTexto(f.hora), (f.estimado ? '≈ ' : '') + String(f.minutos), f.escena, f.numero, f.plano, f.tecnica, f.acciones, f.set, f.momento, f.talentos.join(', '), f.sonido],
    );
    tablaConCopia(caja, `Planos del día ${p.dia}`, ['Hora', 'Min.', 'Esc.', 'N.', 'Plano', 'Descripción técnica', 'Acciones', 'Set', 'D/N', 'Talentos', 'Sonido'], filas, [1, 2, 3]);
    const estimados = p.filas.filter((f) => f.estimado).length;
    if (estimados)
      caja.createDiv({
        cls: 'cp-timing-nota',
        text: `≈ ${estimados} ${estimados === 1 ? 'plano no trae' : 'planos no traen'} «Tiempo de grabación» en el guion técnico: su duración sale de las propiedades del proyecto (minutos_por_plano, o minutos_por_octavo en una escena completa).`,
      });
  }
}

/** La hoja de llamado del día: escenas y llamados del reparto. */
export function renderLlamado(padre: HTMLElement, dias: { plan: PlanDia; llamado: Llamado }[]): void {
  const caja = padre.createDiv({ cls: 'cp-bd cp-timing cp-plan' });
  if (!dias.length) {
    caja.createDiv({ cls: 'cp-msg', text: 'No hay días en el plan de rodaje. Escríbelos en la tabla «Orden de rodaje» de la shooting list.' });
    return;
  }
  for (const { plan, llamado } of dias) {
    encabezadoDia(caja, plan);
    tablaConCopia(
      caja,
      `Escenas del día ${plan.dia}`,
      ['Esc.', 'Set', 'D/N', 'Personajes', 'Planos', 'Octavos', 'Horario'],
      llamado.escenas.map((e) => [e.escena, e.set, e.momento, e.personajes.join(', '), String(e.planos), e.octavos, e.horario]),
      [0, 4, 5],
    );
    tablaConCopia(
      caja,
      `Reparto del día ${plan.dia}`,
      ['Personaje', 'Llamado', 'Primer plano'],
      llamado.reparto.map((r) => [r.personaje, horaTexto(r.llamado), horaTexto(r.primerPlano)]),
      [1, 2],
    );
    if (llamado.equipo.length)
      tablaConCopia(
        caja,
        `Equipo especial del día ${plan.dia}`,
        ['Equipo', 'Escenas'],
        llamado.equipo.map((e) => [e.equipo, e.escenas.join(', ')]),
        [],
      );
  }
}
