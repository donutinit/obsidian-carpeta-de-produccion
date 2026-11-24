import type { Text } from '@codemirror/state';

/** ¿El documento abre con frontmatter que dice `carpeta: guion`? */
export function esDocGuion(doc: Text): boolean {
  if (doc.lines < 2 || doc.line(1).text.trim() !== '---') return false;
  for (let k = 2; k <= Math.min(doc.lines, 40); k++) {
    const t = doc.line(k).text.trim();
    if (t === '---') return false;
    if (/^carpeta:\s*["']?guion["']?\s*$/.test(t)) return true;
  }
  return false;
}
