import type { EditorState } from '@codemirror/state';
import { editorInfoField, type App } from 'obsidian';
import { DICCIONARIOS_MX, type Config, type Diccionarios } from '../../motor';
import { leerConfigProyecto } from '../proyecto';

const memo = new Map<string, { t: number; cfg: Partial<Config> }>();
const VIGENCIA_MS = 1500;

/** La app, la ruta de la nota y la configuración de su proyecto, desde el estado del editor. */
export function contextoDe(state: EditorState): { app: App | null; ruta: string | null; cfg: Partial<Config> } {
  const info = state.field(editorInfoField, false);
  const app = info?.app ?? null;
  const ruta = info?.file?.path ?? null;
  if (!app || !ruta) return { app, ruta, cfg: {} };
  const m = memo.get(ruta);
  const ahora = Date.now();
  if (m && ahora - m.t < VIGENCIA_MS) return { app, ruta, cfg: m.cfg };
  const cfg = leerConfigProyecto(app, ruta);
  memo.set(ruta, { t: ahora, cfg });
  return { app, ruta, cfg };
}

export const diccionariosDe = (state: EditorState): Diccionarios => contextoDe(state).cfg.diccionarios ?? DICCIONARIOS_MX;

export { fichasDelProyecto } from '../proyecto';
