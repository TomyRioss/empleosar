"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaTrash, FaPlus, FaArrowLeft, FaArrowRight, FaWandMagicSparkles, FaUpload, FaCheck, FaXmark } from "react-icons/fa6";
import PasswordInput from "@/app/components/PasswordInput";
import { registerUser, analyzeCvSources } from "./actions";
import { StepIndicator } from "./StepIndicator";
import type { ExperienceEntry, EducationEntry } from "@/lib/profileTypes";
import type { ExtractedProfile } from "@/lib/extractProfile";

const STEP_LABELS = ["Cuenta", "Importar", "Datos", "Experiencia", "Educación", "Perfil"];

const EMPTY_EXPERIENCE: ExperienceEntry = { title: "", company: "", startDate: "", endDate: "", description: "" };
const EMPTY_EDUCATION: EducationEntry = { institution: "", degree: "", startDate: "", endDate: "", description: "" };

const inputClass =
  "bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";
const labelClass = "font-mono text-[11px] uppercase tracking-widest text-text-muted";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function ListInput({
  values,
  onChange,
  placeholder,
  listId,
  suggestions,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  listId?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      e.stopPropagation();
      add();
    }
  }

  return (
    <div className={inputClass + " flex flex-wrap items-center gap-1.5 cursor-text"}>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex items-center gap-1.5 bg-accent/10 text-accent rounded-full pl-2.5 pr-1 py-1 text-xs"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-accent/60 hover:text-accent transition-colors p-0.5"
            aria-label={`Quitar ${v}`}
          >
            <FaXmark size={10} />
          </button>
        </span>
      ))}
      <input
        className="bg-transparent border-0 outline-none text-sm placeholder:text-text-muted/70 flex-1 min-w-28"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ""}
        list={listId}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [phone, setPhone] = useState("");

  const [experience, setExperience] = useState<ExperienceEntry[]>([{ ...EMPTY_EXPERIENCE }]);
  const [education, setEducation] = useState<EducationEntry[]>([]);

  const [summary, setSummary] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);

  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function updateExperience(i: number, field: keyof ExperienceEntry, value: string) {
    setExperience((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }
  function updateEducation(i: number, field: keyof EducationEntry, value: string) {
    setEducation((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!email.trim() || !email.includes("@")) return "Ingresá un email válido";
      if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
      if (password !== confirmPassword) return "Las contraseñas no coinciden";
    }
    if (i === 2) {
      if (!firstName.trim() || !lastName.trim()) return "Nombre y apellido son requeridos";
      if (!province.trim() || !city.trim()) return "Provincia y municipio son requeridos";
    }
    if (i === 3) {
      if (!experience.some((e) => e.title.trim() && e.company.trim())) {
        return "Agregá al menos una experiencia con cargo y empresa";
      }
    }
    return null;
  }

  function goNext() {
    if (analyzing) return;
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    const err = validateStep(3);
    if (err) {
      setError(err);
      setStep(3);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerUser({
        email,
        password,
        firstName,
        lastName,
        province,
        city,
        street,
        phone,
        summary,
        languages,
        skills,
        certifications,
        experience,
        education,
      });
      if (result && "error" in result) {
        setError(result.error);
      } else {
        router.push("/login?registered=1");
      }
    });
  }

  function applyProfile(p: ExtractedProfile) {
    setFirstName((v) => v || p.firstName);
    setLastName((v) => v || p.lastName);
    setPhone((v) => v || p.phone);
    setProvince((v) => v || p.province);
    setCity((v) => v || p.city);
    setStreet((v) => v || p.street);
    setSummary((v) => v || p.summary);
    if (p.languages.length) setLanguages((v) => (v.length ? v : p.languages));
    if (p.skills.length) setSkills((v) => (v.length ? v : p.skills));
    if (p.certifications.length) setCertifications((v) => (v.length ? v : p.certifications));
    if (p.experience.length) {
      setExperience(
        p.experience.map((e) => ({
          title: e.title,
          company: e.company,
          startDate: e.startDate,
          endDate: e.endDate,
          description: e.description,
        })),
      );
    }
    if (p.education.length) {
      setEducation(
        p.education.map((e) => ({
          institution: e.institution,
          degree: e.degree,
          startDate: e.startDate,
          endDate: e.endDate,
          description: e.description,
        })),
      );
    }
  }

  function normalizeUrl(value: string): string {
    const url = value.trim();
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  function isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  async function handleAnalyze() {
    const links = [normalizeUrl(linkedinUrl), normalizeUrl(githubUrl), normalizeUrl(websiteUrl)]
      .filter(Boolean)
      .filter((l) => /^https?:\/\//i.test(l));
    if (cvFiles.length === 0 && links.length === 0) {
      setImportError("Subí al menos un CV o cargá un link a un perfil");
      return;
    }
    for (const link of links) {
      if (!isValidUrl(link)) {
        setImportError(`"${link}" no es una URL válida. Revisá que esté bien escrita.`);
        return;
      }
    }
    setImportError(null);
    setImportWarnings([]);
    setAnalyzing(true);
    try {
      const formData = new FormData();
      for (const f of cvFiles) formData.append("files", f);
      formData.append("links", links.join("\n"));
      const result = await analyzeCvSources(formData);
      if ("error" in result) {
        setImportError(result.error);
      } else {
        applyProfile(result.profile);
        setImportWarnings(result.warnings);
        setImportDone(true);
      }
    } catch {
      setImportError("No se pudo analizar las fuentes. Intentá de nuevo o completá manualmente.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && step < STEP_LABELS.length - 1 && !analyzing) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "TEXTAREA") {
        e.preventDefault();
        goNext();
      }
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <StepIndicator steps={STEP_LABELS} currentIndex={step} />

      {error && (
        <p
          role="alert"
          className="text-sm text-status-discarded bg-status-discarded/10 border border-status-discarded/25 rounded-md px-3 py-2 mb-4"
        >
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className={inputClass}
            />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres">
            <PasswordInput
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>
          <Field label="Confirmar contraseña">
            <PasswordInput
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted -mt-1">
            Opcional: subí tus CVs y/o links a tus perfiles (LinkedIn, etc.) y la IA completa todo solo.
            Después lo revisás y editás en los siguientes pasos. También podés saltear este paso.
          </p>

          <div className="bg-bg border border-dashed border-border rounded-lg p-4 flex flex-col gap-3">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5">
                <FaUpload size={11} /> CVs (PDF o TXT, hasta 5MB c/u)
              </span>
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                setCvFiles((prev) => [...prev, ...files].slice(0, 8));
              }}
              className="text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:text-accent file:cursor-pointer hover:file:bg-accent/20"
            />
            {cvFiles.length > 0 && (
              <ul className="flex flex-col gap-1">
                {cvFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-text">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setCvFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-text-muted hover:text-status-discarded transition-colors p-1"
                      aria-label={`Quitar ${f.name}`}
                    >
                      <FaTrash size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Links a perfiles profesionales" hint="Opcional. Ej: linkedin.com/in/tuusuario">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted w-16 shrink-0">LinkedIn</span>
                <input
                  className={inputClass}
                  inputMode="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/in/tuusuario"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted w-16 shrink-0">GitHub</span>
                <input
                  className={inputClass}
                  inputMode="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="github.com/tuusuario"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted w-16 shrink-0">Sitio</span>
                <input
                  className={inputClass}
                  inputMode="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="misitio.com"
                />
              </div>
            </div>
          </Field>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center justify-center gap-2 bg-accent text-accent-ink font-medium rounded-md px-4 py-2.5 text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            <FaWandMagicSparkles size={13} />
            {analyzing ? "Analizando con IA..." : "Completar con IA"}
          </button>

          {importError && (
            <p role="alert" className="text-sm text-status-discarded bg-status-discarded/10 border border-status-discarded/25 rounded-md px-3 py-2">
              {importError}
            </p>
          )}

          {importDone && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm text-status-saved bg-status-saved/10 border border-status-saved/25 rounded-md px-3 py-2">
                <FaCheck size={12} /> Listo. Revisá y corregí lo cargado en los siguientes pasos.
              </p>
              {importWarnings.length > 0 && (
                <ul className="text-xs text-text-muted flex flex-col gap-1 list-disc pl-5">
                  {importWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre">
              <input
                autoComplete="given-name"
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Apellido">
              <input
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Provincia">
              <input
                autoComplete="address-level1"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Buenos Aires"
                className={inputClass}
              />
            </Field>
            <Field label="Municipio / Ciudad">
              <input
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Avellaneda"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Calle (opcional)">
              <input
                autoComplete="street-address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Av. Mitre 123"
                className={inputClass}
              />
            </Field>
            <Field label="Teléfono (opcional)">
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted -mt-1">
            Esto es lo que la IA usa para armar tus CVs. Agregá al menos una experiencia real.
          </p>
          {experience.map((exp, i) => (
            <div key={i} className="bg-bg border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                  Experiencia {i + 1}
                </span>
                {experience.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-text-muted hover:text-status-discarded transition-colors p-1 -m-1"
                    aria-label={`Eliminar experiencia ${i + 1}`}
                  >
                    <FaTrash size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Cargo"
                  value={exp.title}
                  onChange={(e) => updateExperience(i, "title", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Empresa"
                  value={exp.company}
                  onChange={(e) => updateExperience(i, "company", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Desde (ej. Mar 2021)"
                  value={exp.startDate}
                  onChange={(e) => updateExperience(i, "startDate", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Hasta (ej. Presente)"
                  value={exp.endDate}
                  onChange={(e) => updateExperience(i, "endDate", e.target.value)}
                />
              </div>
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Tareas y logros principales"
                value={exp.description}
                onChange={(e) => updateExperience(i, "description", e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE }])}
            className="flex items-center justify-center gap-2 text-sm text-accent border border-dashed border-accent/40 rounded-lg py-2.5 hover:bg-accent/5 transition-colors"
          >
            <FaPlus size={11} /> Agregar experiencia
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted -mt-1">Opcional, pero recomendado si tenés estudios relevantes.</p>
          {education.map((edu, i) => (
            <div key={i} className="bg-bg border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                  Educación {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-text-muted hover:text-status-discarded transition-colors p-1 -m-1"
                  aria-label={`Eliminar educación ${i + 1}`}
                >
                  <FaTrash size={12} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Institución"
                  value={edu.institution}
                  onChange={(e) => updateEducation(i, "institution", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Título / Carrera"
                  value={edu.degree}
                  onChange={(e) => updateEducation(i, "degree", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Desde"
                  value={edu.startDate}
                  onChange={(e) => updateEducation(i, "startDate", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Hasta"
                  value={edu.endDate}
                  onChange={(e) => updateEducation(i, "endDate", e.target.value)}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEducation((prev) => [...prev, { ...EMPTY_EDUCATION }])}
            className="flex items-center justify-center gap-2 text-sm text-accent border border-dashed border-accent/40 rounded-lg py-2.5 hover:bg-accent/5 transition-colors"
          >
            <FaPlus size={11} /> Agregar educación
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          <Field label="Resumen profesional (opcional)">
            <textarea
              className={inputClass}
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve descripción de tu perfil profesional"
            />
          </Field>
          <Field label="Idiomas" hint="Enter o coma para agregar. Ej: Español (nativo)">
            <ListInput
              values={languages}
              onChange={setLanguages}
              placeholder="Español (nativo)"
              listId="languages-suggestions"
              suggestions={["Español (nativo)", "Inglés", "Portugués", "Francés", "Alemán", "Italiano"]}
            />
          </Field>
          <Field label="Habilidades" hint="Enter o coma para agregar. Una por tag">
            <ListInput values={skills} onChange={setSkills} placeholder="Ej: Excel, Comunicación, Python" />
          </Field>
          <Field label="Certificaciones (opcional)" hint="Enter o coma para agregar">
            <ListInput values={certifications} onChange={setCertifications} placeholder="Ej: AWS Certified, Scrum Master" />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <FaArrowLeft size={11} /> Atrás
          </button>
        ) : (
          <span />
        )}

        {step < STEP_LABELS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={analyzing}
            className="flex items-center gap-1.5 bg-accent text-accent-ink font-medium rounded-md px-4 py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            Siguiente <FaArrowRight size={11} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-accent text-accent-ink font-medium rounded-md px-4 py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            {isPending ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        )}
      </div>

      <p className="text-sm text-text-muted mt-5 text-center">
        Ya tenés cuenta?{" "}
        <Link href="/login" className="text-accent underline underline-offset-4">
          Ingresá
        </Link>
      </p>
    </div>
  );
}
