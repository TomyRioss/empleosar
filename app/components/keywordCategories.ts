import {
  FaUtensils,
  FaHeadset,
  FaBuilding,
  FaCode,
  FaTruck,
  FaHospital,
  FaHammer,
  FaStar,
  FaStore,
  FaBroom,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export const KEYWORD_CATEGORIES: { name: string; icon: IconType; terms: string[] }[] = [
  { name: "Gastronomía", icon: FaUtensils, terms: ["gastronomia", "cocinero", "chef", "ayudante de cocina", "mozo", "camarero", "mesero", "bartender", "barista", "panadero", "repostero", "delivery", "encargado de local gastronomico"] },
  { name: "Ventas", icon: FaStore, terms: ["ventas", "vendedor", "representante comercial", "promotor", "cajero", "telemarketer", "telemarketing"] },
  { name: "Atención al cliente", icon: FaHeadset, terms: ["atencion al cliente", "call center", "recepcionista"] },
  { name: "Administración", icon: FaBuilding, terms: ["administrativo", "secretaria", "data entry", "facturista", "auxiliar contable", "contador", "recursos humanos", "asistente de gerencia"] },
  { name: "Tecnología", icon: FaCode, terms: ["desarrollador react", "developer", "programador", "analista de sistemas", "soporte tecnico", "it", "frontend", "backend", "fullstack", "qa", "diseñador ux", "devops", "data analyst"] },
  { name: "Logística", icon: FaTruck, terms: ["operario", "almacen", "deposito", "logistica", "repartidor", "cadete", "chofer", "flete", "distribucion", "picking", "packing"] },
  { name: "Salud", icon: FaHospital, terms: ["enfermero", "medico", "odontologo", "kinesiologo", "farmaceutico", "auxiliar de enfermeria", "cuidador", "recepcionista clinica"] },
  { name: "Construcción", icon: FaHammer, terms: ["albañil", "pintor", "electricista", "plomero", "herrero", "carpintero", "mantenimiento", "jardinero"] },
  { name: "Limpieza", icon: FaBroom, terms: ["limpieza", "mucama", "empleada domestica"] },
  { name: "Servicios", icon: FaStar, terms: ["seguridad", "vigilante", "niñera", "peluquero", "esteticista", "masajista", "profesor", "traductor", "community manager", "fotografo"] },
];

export function getKeywordCategory(term: string): string | null {
  for (const { name, terms } of KEYWORD_CATEGORIES) {
    if (terms.includes(term)) return name;
  }
  return null;
}

export function getKeywordCategoryIcon(term: string): IconType | null {
  for (const { icon, terms } of KEYWORD_CATEGORIES) {
    if (terms.includes(term)) return icon;
  }
  return null;
}
