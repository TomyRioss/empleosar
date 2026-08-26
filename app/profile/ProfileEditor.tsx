"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";
import { TagInput } from "./TagInput";
import type { ExperienceEntry, EducationEntry, ProfileData } from "@/lib/profileTypes";

const inputClass =
  "bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "font-mono text-[11px] uppercase tracking-widest text-text-muted";

const EMPTY_EXPERIENCE: ExperienceEntry = { title: "", company: "", startDate: "", endDate: "", description: "" };
const EMPTY_EDUCATION: EducationEntry = { institution: "", degree: "", startDate: "", endDate: "", description: "" };

export function ProfileEditor({ initial }: { initial: ProfileData }) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [province, setProvince] = useState(initial.province);
  const [city, setCity] = useState(initial.city);
  const [street, setStreet] = useState(initial.street);
  const [showStreetInCv, setShowStreetInCv] = useState(initial.showStreetInCv);
  const [phone, setPhone] = useState(initial.phone);
  const [summary, setSummary] = useState(initial.summary);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [certifications, setCertifications] = useState<string[]>(initial.certifications);
  const [experience, setExperience] = useState<ExperienceEntry[]>(
    initial.experience.length ? initial.experience : [],
  );
  const [education, setEducation] = useState<EducationEntry[]>(
    initial.education.length ? initial.education : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateExperience(i: number, field: keyof ExperienceEntry, value: string) {
    setExperience((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function updateEducation(i: number, field: keyof EducationEntry, value: string) {
    setEducation((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("province", province);
    formData.set("city", city);
    formData.set("street", street);
    formData.set("showStreetInCv", String(showStreetInCv));
    formData.set("phone", phone);
    formData.set("summary", summary);
    formData.set("languages", languages.join("\n"));
    formData.set("skills", skills.join("\n"));
    formData.set("certifications", certifications.join("\n"));
    formData.set("experienceJson", JSON.stringify(experience.filter((x) => x.title || x.company)));
    formData.set("educationJson", JSON.stringify(education.filter((x) => x.institution || x.degree)));

    startTransition(async () => {
      try {
        await updateProfile(formData);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">
      <div className="flex flex-col gap-6 lg:sticky lg:top-8">
        <section className="flex flex-col gap-3">
          <h2 className="font-display font-semibold text-text">Datos personales</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Nombre</label>
              <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Apellido</label>
              <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Provincia</label>
              <input className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Municipio / Ciudad</label>
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Calle (opcional)</label>
            <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} />
            <label className="flex items-center gap-2 mt-1.5 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={showStreetInCv}
                onChange={(e) => setShowStreetInCv(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Mostrar calle en el CV generado
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Teléfono (opcional)</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Resumen profesional</label>
            <textarea
              className={inputClass}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve descripción de tu perfil profesional"
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-accent text-accent-ink font-medium rounded px-4 py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar perfil"}
          </button>
          {error && <p className="text-sm text-status-discarded">{error}</p>}
          {saved && <p className="text-sm text-status-applied">Perfil guardado.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-text">Experiencia laboral</h2>
            <button
              type="button"
              onClick={() => setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE }])}
              className="text-sm text-accent underline underline-offset-4"
            >
              + Agregar
            </button>
          </div>
          {experience.map((exp, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Desde (ej. Ene 2022)"
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
                placeholder="Descripción de tareas y logros"
                value={exp.description}
                onChange={(e) => updateExperience(i, "description", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-sm text-status-discarded self-start"
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-text">Educación</h2>
            <button
              type="button"
              onClick={() => setEducation((prev) => [...prev, { ...EMPTY_EDUCATION }])}
              className="text-sm text-accent underline underline-offset-4"
            >
              + Agregar
            </button>
          </div>
          {education.map((edu, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Descripción (opcional)"
                value={edu.description}
                onChange={(e) => updateEducation(i, "description", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-sm text-status-discarded self-start"
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TagInput label="Idiomas" values={languages} onChange={setLanguages} placeholder="Ej. Inglés C1" />
          <TagInput label="Habilidades" values={skills} onChange={setSkills} placeholder="Ej. React" />
          <TagInput
            label="Certificaciones"
            values={certifications}
            onChange={setCertifications}
            placeholder="Ej. AWS Certified"
          />
        </section>
      </div>
    </form>
  );
}
