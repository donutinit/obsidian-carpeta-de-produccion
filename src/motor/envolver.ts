import type { Segmento } from './tipos';

/**
 * Reparte los segmentos en líneas de `ancho` caracteres como máximo.
 * Corta en el último espacio que quepa; si no hay, corta la palabra en el ancho.
 * Una marca que cruza el corte aparece en las dos líneas.
 */
export function envolver(segs: Segmento[], ancho: number): Segmento[][] {
  const chars: { ch: string; si: number }[] = [];
  segs.forEach((s, si) => {
    for (const ch of s.t) chars.push({ ch, si });
  });
  const ancho1 = Math.max(1, Math.floor(ancho));
  const cortes: (typeof chars)[] = [];
  const n = chars.length;
  let i = 0;
  while (i < n) {
    if (cortes.length) while (i < n && chars[i].ch === ' ') i++;
    if (i >= n) break;
    let fin = Math.min(i + ancho1, n);
    if (fin < n) {
      let espacio = -1;
      for (let k = fin; k > i; k--) {
        if (chars[k].ch === ' ') {
          espacio = k;
          break;
        }
      }
      if (espacio > i) fin = espacio;
    }
    cortes.push(chars.slice(i, fin));
    i = fin;
  }
  if (!cortes.length) return [[]];
  return cortes.map((linea) => {
    const res: (Segmento & { si: number })[] = [];
    for (const c of linea) {
      const ultimo = res[res.length - 1];
      if (ultimo && ultimo.si === c.si) ultimo.t += c.ch;
      else res.push({ ...segs[c.si], t: c.ch, si: c.si });
    }
    if (res.length) res[res.length - 1].t = res[res.length - 1].t.replace(/\s+$/, '');
    return res.filter((s) => s.t !== '').map(({ si: _si, ...s }) => s);
  });
}
