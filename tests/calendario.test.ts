import { describe, expect, it } from 'vitest';
import {
  celdaDeTabla,
  cuadriculaMes,
  escribirCelda,
  escribirFecha,
  esCeldaDeFecha,
  fechaDePareja,
  iniciosDeTabla,
  filaCoincide,
  tablaCoincide,
  tablaRepetida,
  mismaNota,
  leerFecha,
  sumarDias,
  sumarMeses,
} from '../src/motor';

const RUTA = [
  '# Ruta crítica', //                                                          0
  '',
  '| Semana | Área | Actividad | Inicio | Fin | Responsable | Ruta crítica |', // 2
  '|---:|---|---|---|---|---|---|',
  '| — | Producción | Guion bloqueado y desglose | — | — | — | — |', //        4 → fila 0
  '| 1 | Locaciones | Scouting de locaciones | 04/01/2027 | 2027-01-15 | Ana | Sí |', // fila 1
  '',
  '## Día 1',
  '',
  '| Dato | Valor |', //                                                        9
  '|---|---|',
  '| Fecha | — |',
  '| Fin de rodaje | — |',
  '',
  '| Día | Fecha | Locación |', //                                              14
  '|---:|---|---|',
  '| 1 | — | Casa |',
].join('\n');

describe('celdas de tabla', () => {
  it('ubica la celda por renglón de la tabla, fila y columna', () => {
    const c = celdaDeTabla(RUTA, 2, 0, 3)!;
    expect(c.encabezado).toBe('Inicio');
    expect(c.etiqueta).toBe('—');
    expect(c.texto).toBe('—');
    expect(RUTA.slice(c.desde, c.hasta)).toBe('—');
    const d = celdaDeTabla(RUTA, 2, 1, 4)!;
    expect(d.texto).toBe('2027-01-15');
    expect(RUTA.slice(d.desde, d.hasta)).toBe('2027-01-15');
  });

  it('fuera de la tabla, fuera de rango o sin tabla da null', () => {
    expect(celdaDeTabla(RUTA, 0, 0, 0)).toBeNull();
    expect(celdaDeTabla(RUTA, 2, 2, 0)).toBeNull();
    expect(celdaDeTabla(RUTA, 2, 0, 9)).toBeNull();
    expect(celdaDeTabla(RUTA, 4, 0, 0)).toBeNull();
  });

  it('columnas Inicio, Fin y Fecha son de fecha; Semana, Día y las demás no', () => {
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 2, 0, 3)!)).toBe(true);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 2, 0, 4)!)).toBe(true);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 14, 0, 1)!)).toBe(true);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 2, 0, 0)!)).toBe(false);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 2, 0, 5)!)).toBe(false);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 14, 0, 0)!)).toBe(false);
  });

  it('en una tabla de dato y valor, el valor del renglón «Fecha» es de fecha', () => {
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 9, 0, 1)!)).toBe(true);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 9, 0, 0)!)).toBe(false);
    expect(esCeldaDeFecha(celdaDeTabla(RUTA, 9, 1, 1)!)).toBe(false);
  });

  it('encabezados con acentos, mayúsculas o negritas, y «Fecha de entrega»', () => {
    const t = '| **INICIO** | fecha de entrega | Fín |\n|---|---|---|\n| a | b | c |';
    expect([0, 1, 2].map((k) => esCeldaDeFecha(celdaDeTabla(t, 0, 0, k)!))).toEqual([true, true, true]);
  });

  it('tabla sin barras en los bordes y con \\| dentro de una celda', () => {
    const t = 'Actividad | Inicio\n--- | ---\nGuion a\\|b | 04/01/2027';
    const c = celdaDeTabla(t, 0, 0, 1)!;
    expect(c.encabezado).toBe('Inicio');
    expect(c.texto).toBe('04/01/2027');
    expect(celdaDeTabla(t, 0, 0, 0)!.texto).toBe('Guion a\\|b');
  });

  it('encuentra el encabezado de cada tabla, y no las que van dentro de un bloque de código', () => {
    expect(iniciosDeTabla(RUTA)).toEqual([2, 9, 14]);
    expect(iniciosDeTabla('```\n| a | b |\n|---|---|\n```\n\n| c | d |\n|---|---|')).toEqual([5]);
  });

  it('la fila que se ve coincide con la fila del texto, y no con otra', () => {
    const fila1 = ['1', 'Locaciones', 'Scouting de locaciones', '04/01/2027', '2027-01-15', 'Ana', 'Sí'];
    expect(filaCoincide(RUTA, 2, 1, fila1)).toBe(true);
    expect(filaCoincide(RUTA, 2, 0, fila1)).toBe(false);
    expect(filaCoincide(RUTA, 2, -1, ['Semana', 'Área', 'Actividad', 'Inicio', 'Fin', 'Responsable', 'Ruta crítica'])).toBe(true);
    expect(filaCoincide(RUTA, 9, -1, ['Semana', 'Área', 'Actividad', 'Inicio', 'Fin', 'Responsable', 'Ruta crítica'])).toBe(false);
    expect(filaCoincide(RUTA, 2, 5, fila1)).toBe(false);
  });

  it('la fila que se ve: sin negritas, enlaces, \\| ni celdas que faltan', () => {
    const t = '| **Fecha** | Nota |\n|---|---|\n| [[Plan\\|el plan]] | a\\|b |\n| solo |';
    expect(filaCoincide(t, 0, -1, ['Fecha', 'Nota'])).toBe(true);
    expect(filaCoincide(t, 0, 0, ['el plan', 'a|b'])).toBe(true);
    expect(filaCoincide(t, 0, 1, ['solo', ''])).toBe(true);
    expect(filaCoincide(t, 0, 1, ['otra', ''])).toBe(false);
  });

  it('la tabla dibujada completa coincide con la del texto, con sus filas', () => {
    const dibujada = [
      ['Semana', 'Área', 'Actividad', 'Inicio', 'Fin', 'Responsable', 'Ruta crítica'],
      ['—', 'Producción', 'Guion bloqueado y desglose', '—', '—', '—', '—'],
      ['1', 'Locaciones', 'Scouting de locaciones', '04/01/2027', '2027-01-15', 'Ana', 'Sí'],
    ];
    expect(tablaCoincide(RUTA, 2, dibujada)).toBe(true);
    expect(tablaCoincide(RUTA, 2, dibujada.slice(0, 2))).toBe(false);
    expect(tablaCoincide(RUTA, 9, dibujada)).toBe(false);
    expect(tablaCoincide(RUTA, 9, [['Dato', 'Valor'], ['Fecha', '—'], ['Fin de rodaje', '—']])).toBe(true);
  });

  it('una tabla repetida igual en la nota, sin contar espacios ni guiones del separador', () => {
    const dia = '| Dato | Valor |\n|---|---|\n| Fecha | — |';
    const t = `## Día 1\n\n${dia}\n\n## Día 2\n\n| Dato  | Valor |\n| ----- | ----- |\n| Fecha | —     |\n\n## Día 3\n\n| Dato | Valor |\n|---|---|\n| Fecha | 04/01/2027 |`;
    expect(tablaRepetida(t, 2)).toBe(true);
    expect(tablaRepetida(t, 8)).toBe(true);
    expect(tablaRepetida(t, 14)).toBe(false);
    expect(tablaRepetida(RUTA, 2)).toBe(false);
  });

  it('la misma nota aunque Obsidian alinee los espacios y los guiones de la tabla, y otra si cambió algo más', () => {
    const a = '# T\n\n| a | Fecha |\n|---:|---|\n| x |—|';
    expect(mismaNota(a, '# T\n\n| a     | Fecha |\n| ----: | ----- |\n| x     | —     |')).toBe(true);
    expect(mismaNota(a, '# T\n\n| a | Fecha |\n|---:|---|\n| x | — |\n| y | — |')).toBe(false);
    expect(mismaNota(a, '## T\n\n| a | Fecha |\n|---:|---|\n| x |—|')).toBe(false);
    expect(mismaNota(a, '# T\n| a | Fecha |\n|---:|---|\n| x |—|')).toBe(false);
    expect(mismaNota(a, '# T\n\n| a | Fecha |\n|---|---|\n| x |—|')).toBe(false);
  });

  it('el renglón de separación es obligatorio', () => {
    expect(celdaDeTabla('| a | b |\n| c | d |', 0, 0, 0)).toBeNull();
  });

  it('escribir reemplaza solo el contenido de la celda', () => {
    const c = celdaDeTabla(RUTA, 2, 0, 3)!;
    const r = escribirCelda(c, '04/01/2027');
    const nuevo = RUTA.slice(0, r.desde) + r.texto + RUTA.slice(r.hasta);
    expect(nuevo.split('\n')[4]).toBe('| — | Producción | Guion bloqueado y desglose | 04/01/2027 | — | — | — |');
    expect(nuevo.split('\n').length).toBe(RUTA.split('\n').length);
  });

  it('escribir en una celda vacía deja un espacio a cada lado', () => {
    for (const fila of ['| a || c |', '| a |  | c |']) {
      const t = '| x | Fecha | z |\n|---|---|---|\n' + fila;
      const r = escribirCelda(celdaDeTabla(t, 0, 0, 1)!, '04/01/2027');
      expect((t.slice(0, r.desde) + r.texto + t.slice(r.hasta)).split('\n')[2]).toBe('| a | 04/01/2027 | c |');
    }
  });

  it('la fecha de la pareja: Inicio de la misma fila al elegir Fin, y al revés', () => {
    expect(fechaDePareja(RUTA, 2, 1, 4)).toEqual({ encabezado: 'Inicio', fecha: { a: 2027, m: 1, d: 4 } });
    expect(fechaDePareja(RUTA, 2, 1, 3)).toEqual({ encabezado: 'Fin', fecha: { a: 2027, m: 1, d: 15 } });
    expect(fechaDePareja(RUTA, 2, 0, 4)).toBeNull();
    expect(fechaDePareja(RUTA, 14, 0, 1)).toBeNull();
  });
});

describe('fechas', () => {
  it('lee ISO y día/mes/año', () => {
    expect(leerFecha('2027-01-04')).toEqual({ a: 2027, m: 1, d: 4 });
    expect(leerFecha('04/01/2027')).toEqual({ a: 2027, m: 1, d: 4 });
    expect(leerFecha(' 4/1/2027 ')).toEqual({ a: 2027, m: 1, d: 4 });
    expect(leerFecha('4/1/27')).toEqual({ a: 2027, m: 1, d: 4 });
    expect(leerFecha('4-1-2027')).toEqual({ a: 2027, m: 1, d: 4 });
  });

  it('no inventa fechas', () => {
    for (const s of ['—', '', 'por definir', '31/02/2027', '2027-13-01', '0/1/2027', '29/02/2027']) expect(leerFecha(s), s).toBeNull();
    expect(leerFecha('29/02/2028')).toEqual({ a: 2028, m: 2, d: 29 });
  });

  it('escribe día/mes/año con ceros', () => {
    expect(escribirFecha({ a: 2027, m: 1, d: 4 })).toBe('04/01/2027');
    expect(escribirFecha({ a: 2027, m: 12, d: 31 })).toBe('31/12/2027');
  });

  it('suma días y meses cruzando meses y años', () => {
    expect(sumarDias({ a: 2027, m: 1, d: 31 }, 1)).toEqual({ a: 2027, m: 2, d: 1 });
    expect(sumarDias({ a: 2027, m: 1, d: 1 }, -1)).toEqual({ a: 2026, m: 12, d: 31 });
    expect(sumarDias({ a: 2027, m: 3, d: 1 }, -7)).toEqual({ a: 2027, m: 2, d: 22 });
    expect(sumarMeses({ a: 2027, m: 1, d: 31 }, 1)).toEqual({ a: 2027, m: 2, d: 28 });
    expect(sumarMeses({ a: 2027, m: 1, d: 15 }, -1)).toEqual({ a: 2026, m: 12, d: 15 });
  });

  it('cuadrícula del mes con la semana de lunes a domingo', () => {
    const ene = cuadriculaMes(2027, 1); // 1 de enero de 2027 es viernes
    expect(ene.length).toBe(5);
    expect(ene[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(ene[4]).toEqual([25, 26, 27, 28, 29, 30, 31]);
    const feb = cuadriculaMes(2027, 2); // empieza en lunes y tiene 28 días
    expect(feb.length).toBe(4);
    expect(feb[0][0]).toBe(1);
    const ago = cuadriculaMes(2027, 8); // empieza en domingo: seis semanas
    expect(ago.length).toBe(6);
    expect(ago[0]).toEqual([null, null, null, null, null, null, 1]);
  });
});
