"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaTrash, FaPlus, FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import { registerUser } from "./actions";
import { StepIndicator } from "./StepIndicator";
import type { ExperienceEntry, EducationEntry } from "@/lib/profileTypes";

const STEP_LABELS = ["Cuenta", "Datos", "Experiencia", "Educación", "Perfil"];

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
  const [languages, setLanguages] = useState("");
  const [skills, setSkills] = useState("");
  const [certifications, setCertifications] = useState("");

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
    if (i === 1) {
      if (!firstName.trim() || !lastName.trim()) return "Nombre y apellido son requeridos";
      if (!province.trim() || !city.trim()) return "Provincia y municipio son requeridos";
    }
    if (i === 2) {
      if (!experience.some((e) => e.title.trim() && e.company.trim())) {
        return "Agregá al menos una experiencia con cargo y empresa";
      }
    }
    return null;
  }

  function goNext() {
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
    const err = validateStep(2);
    if (err) {
      setError(err);
      setStep(2);
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
        languages: languages.split("\n").map((s) => s.trim()).filter(Boolean),
        skills: skills.split("\n").map((s) => s.trim()).filter(Boolean),
        certifications: certifications.split("\n").map((s) => s.trim()).filter(Boolean),
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && step < STEP_LABELS.length - 1) {
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
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>
          <Field label="Confirmar contraseña">
            <input
              type="password"
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

      {step === 2 && (
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

      {step === 3 && (
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

      {step === 4 && (
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
          <Field label="Idiomas" hint="Uno por línea, ej. Español (nativo)">
            <textarea className={inputClass} rows={2} value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </Field>
          <Field label="Habilidades" hint="Una por línea">
            <textarea className={inputClass} rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} />
          </Field>
          <Field label="Certificaciones (opcional)" hint="Una por línea">
            <textarea
              className={inputClass}
              rows={2}
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
            />
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
            className="flex items-center gap-1.5 bg-accent text-accent-ink font-medium rounded-md px-4 py-2 text-sm hover:brightness-110 transition"
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
