import { deepseekJson } from "@/lib/deepseek";

const SYSTEM_PROMPT = `Resumís avisos laborales para un bolsín de empleos argentino.
Dado el texto completo de un aviso, escribí un resumen breve (3-5 líneas, texto corrido,
sin bullets ni markdown) que cubra: de qué trata el puesto, requisitos clave y
beneficios/condiciones destacables si los hay. Español neutro de Argentina, directo,
sin inventar datos que no estén en el texto. Devolvé SOLO un JSON: {"summary": string}`;

export async function summarizeJobDescription(description: string): Promise<string> {
  const { summary } = await deepseekJson<{ summary: string }>(SYSTEM_PROMPT, description.slice(0, 6000));
  return summary.trim();
}
