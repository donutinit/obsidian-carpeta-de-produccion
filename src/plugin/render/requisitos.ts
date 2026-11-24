import { verificarRequisitos, type Guion, type Reglas } from '../../motor';

const ETIQUETA = { ok: 'Bien', advertencia: 'Cuidado', falla: 'Falla' } as const;
const CLASE = { ok: 'cp-t-extra', advertencia: 'cp-t-silent', falla: 'cp-t-rep' } as const;

/** Tabla del verificador de requisitos. Los estados usan colores de la paleta medida (7:1). */
export function renderRequisitos(padre: HTMLElement, g: Guion, reglas: Reglas): void {
  const caja = padre.createDiv({ cls: 'cp-bd' });
  caja.createEl('h3', { text: 'Requisitos de producción' });
  const r = verificarRequisitos(g, reglas);
  if (!r.length) {
    caja.createDiv({
      cls: 'cp-msg',
      text: 'El proyecto no tiene restricciones. Agrégalas en las propiedades de «00 - Proyecto»: max_paginas, max_duracion, max_escenas, max_locaciones, max_personajes, max_personajes_escena, max_noches_pct, min_escenas_por_locacion, locaciones_principales y min_principales_pct.',
    });
    return;
  }
  const t = caja.createEl('table', { cls: 'cp-table' });
  const cab = t.createEl('thead').createEl('tr');
  ['Regla', 'Estado', 'Detalle', 'Dónde'].forEach((x) => cab.createEl('th', { text: x }));
  const cuerpo = t.createEl('tbody');
  for (const x of r) {
    const fila = cuerpo.createEl('tr');
    fila.createEl('td', { text: x.nombre });
    fila.createEl('td').createSpan({ cls: `cp-mark ${CLASE[x.estado]}`, text: ETIQUETA[x.estado] });
    fila.createEl('td', { text: x.detalle });
    fila.createEl('td', { text: x.culpables.join(', ') || '—' });
  }
}
