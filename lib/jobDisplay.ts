import { JobSource } from "@prisma/client";

export const SOURCE_COLOR: Record<JobSource, string> = {
  LINKEDIN: "border-source-linkedin/40",
  COMPUTRABAJO: "border-source-computrabajo/40",
  ZONAJOBS: "border-source-zonajobs/40",
  REDDIT: "border-source-reddit/40",
};

export const SOURCE_LOGO: Record<JobSource, string> = {
  LINKEDIN: "/logos/linkedin.png",
  COMPUTRABAJO: "/logos/computrabajo.png",
  ZONAJOBS: "/logos/zonajobs.png",
  REDDIT: "/logos/reddit.png",
};

export function timeAgo(date: Date | null): string {
  if (!date) return "nunca";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min${minutes > 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hr${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
