export type ExperienceEntry = {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EducationEntry = {
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type ProfileData = {
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  city: string;
  street: string;
  showStreetInCv: boolean;
  summary: string;
  languages: string[];
  skills: string[];
  certifications: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
};

export function isProfileComplete(p: {
  firstName: string;
  lastName: string;
  province: string;
  city: string;
  experience: unknown;
} | null): boolean {
  if (!p) return false;
  const experience = Array.isArray(p.experience) ? p.experience : [];
  return !!(p.firstName && p.lastName && p.province && p.city && experience.length > 0);
}
