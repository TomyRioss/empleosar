import { extractText, getDocumentProxy } from "unpdf";
import { deepseekJson } from "@/lib/deepseek";

export type ExtractedProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  city: string;
  street: string;
  summary: string;
  languages: string[];
  skills: string[];
  certifications: string[];
  experience: { title: string; company: string; startDate: string; endDate: string; description: string }[];
  education: { institution: string; degree: string; startDate: string; endDate: string; description: string }[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 8;
const MAX_LINKS = 8;
const MAX_CHARS_PER_SOURCE = 15_000;
const MAX_TOTAL_CHARS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).replace(/\s+/g, " ").trim();
}

async function fetchLinkText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = htmlToPlainText(html);
  if (text.length < 200) throw new Error("la página no expone contenido legible (probablemente requiere login)");
  return text;
}

function clampStrings(profile: ExtractedProfile): ExtractedProfile {
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300)) : [];
  return {
    firstName: s(profile.firstName).slice(0, 80),
    lastName: s(profile.lastName).slice(0, 80),
    phone: s(profile.phone).slice(0, 40),
    province: s(profile.province).slice(0, 80),
    city: s(profile.city).slice(0, 80),
    street: s(profile.street).slice(0, 160),
    summary: s(profile.summary).slice(0, 2000),
    languages: arr(profile.languages),
    skills: arr(profile.skills),
    certifications: arr(profile.certifications),
    experience: (Array.isArray(profile.experience) ? profile.experience : [])
      .slice(0, 15)
      .map((e) => ({
        title: s(e?.title).slice(0, 160),
        company: s(e?.company).slice(0, 160),
        startDate: s(e?.startDate).slice(0, 40),
        endDate: s(e?.endDate).slice(0, 40),
        description: s(e?.description).slice(0, 2000),
      }))
      .filter((e) => e.title && e.company),
    education: (Array.isArray(profile.education) ? profile.education : [])
      .slice(0, 10)
      .map((e) => ({
        institution: s(e?.institution).slice(0, 160),
        degree: s(e?.degree).slice(0, 160),
        startDate: s(e?.startDate).slice(0, 40),
        endDate: s(e?.endDate).slice(0, 40),
        description: s(e?.description).slice(0, 1000),
      }))
      .filter((e) => e.institution && e.degree),
  };
}

const SYSTEM_PROMPT = `Sos un extractor de datos de CVs y perfiles profesionales argentinos.
Recibís una o más fuentes etiquetadas (texto de CVs en PDF y/o páginas de perfiles como LinkedIn).
Devolvé EXCLUSIVAMENTE un JSON con esta forma exacta:
{"firstName":"","lastName":"","phone":"","province":"","city":"","street":"","summary":"","languages":[],"skills":[],"certifications":[],"experience":[{"title":"","company":"","startDate":"","endDate":"","description":""}],"education":[{"institution":"","degree":"","startDate":"","endDate":"","description":""}]}
Reglas:
- Extraé SOLO datos que estén explícitamente en las fuentes. Si un campo no aparece, devolvé "" o []. NUNCA inventes.
- Si varias fuentes se contradicen, usá la más reciente/completa.
- Fechas tal cual aparecen o en formato corto ("Mar 2021", "2020 - 2023", "Presente").
- summary: 2-4 oraciones en primera persona implícita, español rioplatense, solo si hay material para armarla.
- skills: habilidades concretas y herramientas, sin repetir.
- province/city: solo si figuran en las fuentes (ej. "Buenos Aires", "Avellaneda").`;

export async function analyzeProfileSources(
  files: { name: string; buffer: ArrayBuffer }[],
  links: string[],
): Promise<{ profile: ExtractedProfile; warnings: string[] }> {
  if (files.length === 0 && links.length === 0) {
    throw new Error("No hay nada para analizar: subí al menos un CV o un link");
  }
  if (files.length > MAX_FILES) throw new Error(`Máximo ${MAX_FILES} archivos`);
  if (links.length > MAX_LINKS) throw new Error(`Máximo ${MAX_LINKS} links`);

  const warnings: string[] = [];
  const sources: { label: string; text: string }[] = [];
  let totalChars = 0;

  for (const file of files) {
    if (file.buffer.byteLength > MAX_FILE_BYTES) {
      warnings.push(`${file.name}: supera 5MB, se ignoró`);
      continue;
    }
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const isTxt = /\.(txt|md)$/i.test(file.name);
    if (!isPdf && !isTxt) {
      warnings.push(`${file.name}: formato no soportado (usá PDF o TXT), se ignoró`);
      continue;
    }
    try {
      const text = isPdf
        ? await pdfToText(file.buffer)
        : new TextDecoder().decode(file.buffer).replace(/\s+/g, " ").trim();
      if (text.length < 50) throw new Error("sin texto extraíble (¿escaneado sin OCR?)");
      sources.push({ label: `CV "${file.name}"`, text: text.slice(0, MAX_CHARS_PER_SOURCE) });
      totalChars += text.length;
    } catch (err) {
      warnings.push(`${file.name}: no se pudo leer (${err instanceof Error ? err.message : "error"})`);
    }
  }

  for (const link of links) {
    try {
      const text = await fetchLinkText(link);
      sources.push({ label: `Perfil online ${link}`, text: text.slice(0, MAX_CHARS_PER_SOURCE) });
      totalChars += text.length;
    } catch (err) {
      warnings.push(
        `${link}: no se pudo leer (${err instanceof Error ? err.message : "error"}). Podés subir tu CV como PDF.`
      );
    }
    if (totalChars > MAX_TOTAL_CHARS) break;
  }

  if (sources.length === 0) {
    throw new Error("Ninguna fuente pudo leerse. Subí un CV en PDF (no escaneado) e intentá de nuevo.");
  }

  const userPrompt = sources
    .map((s) => `===== ${s.label} =====\n${s.text}`)
    .join("\n\n")
    .slice(0, MAX_TOTAL_CHARS);

  const raw = await deepseekJson<ExtractedProfile>(SYSTEM_PROMPT, userPrompt);
  return { profile: clampStrings(raw), warnings };
}
