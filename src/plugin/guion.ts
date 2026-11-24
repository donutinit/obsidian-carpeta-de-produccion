import type { App, TFile } from 'obsidian';
import { construir, type Guion } from '../motor';
import { leerConfigProyecto } from './proyecto';

/** Construye el guion de una nota con la configuración de su proyecto. `texto` evita releer el archivo mientras se escribe. */
export async function construirDe(app: App, guion: TFile, texto?: string): Promise<Guion> {
  const fuente = typeof texto === 'string' ? texto : await app.vault.cachedRead(guion);
  return construir(fuente, leerConfigProyecto(app, guion.path));
}
