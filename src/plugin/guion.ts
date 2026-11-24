import type { App, TFile } from 'obsidian';
import { construir, equipoDeTecnico, sumarEquipoTecnico, type EquipoDePlano, type Guion } from '../motor';
import { leerConfigProyecto, notasDelProyecto } from './proyecto';

/** El equipo de cada guion técnico, mientras la nota no cambie: así escribir en el guion no relee sus tablas. */
const equipoPorNota = new Map<string, { mtime: number; filas: EquipoDePlano[] }>();

async function equipoDe(app: App, nota: TFile): Promise<EquipoDePlano[]> {
  const previo = equipoPorNota.get(nota.path);
  if (previo && previo.mtime === nota.stat.mtime) return previo.filas;
  const filas = equipoDeTecnico(await app.vault.cachedRead(nota));
  equipoPorNota.set(nota.path, { mtime: nota.stat.mtime, filas });
  return filas;
}

/**
 * Construye el guion de una nota con la configuración de su proyecto y le suma al breakdown el equipo especial que
 * pide el guion técnico (`equipo: false` lo omite, para las vistas que no muestran el breakdown).
 * `texto` evita releer el archivo mientras se escribe.
 */
export async function construirDe(app: App, guion: TFile, texto?: string, opciones: { equipo?: boolean } = {}): Promise<Guion> {
  const fuente = typeof texto === 'string' ? texto : await app.vault.cachedRead(guion);
  const g = construir(fuente, leerConfigProyecto(app, guion.path));
  if (opciones.equipo !== false) for (const n of notasDelProyecto(app, guion, 'guion-tecnico')) sumarEquipoTecnico(g, await equipoDe(app, n));
  return g;
}
