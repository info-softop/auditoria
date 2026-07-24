import type { Role } from "@/generated/prisma";
import {
  LayoutDashboard,
  Upload,
  TriangleAlert,
  BarChart3,
  Target,
  Truck,
  Landmark,
  Camera,
  ReceiptText,
  Store,
  Users,
  ScrollText,
  UserCog,
  FileBarChart,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // si se omite, visible para todos
  group: "Auditoría" | "Reportes" | "Comercial" | "Finanzas" | "Configuración" | "RRHH";
}

export const NAV_ITEMS: NavItem[] = [
  // AUDITORÍA
  { href: "/", label: "Resumen", icon: LayoutDashboard, group: "Auditoría" },
  { href: "/cargar", label: "Cargar reportes", icon: Upload, group: "Auditoría", roles: ["ADMIN", "AUDITOR"] },
  { href: "/alertas", label: "Alertas", icon: TriangleAlert, group: "Auditoría" },

  // REPORTES
  { href: "/reportes/gastos", label: "Informe de Gastos", icon: FileBarChart, group: "Reportes", roles: ["ADMIN", "AUDITOR"] },
  { href: "/reportes/compras", label: "Informe de Compras", icon: ShoppingCart, group: "Reportes", roles: ["ADMIN", "AUDITOR"] },

  // COMERCIAL
  { href: "/analisis", label: "Análisis", icon: BarChart3, group: "Comercial" },
  { href: "/metas", label: "Metas y rendimiento", icon: Target, group: "Comercial" },
  { href: "/proveedores", label: "Proveedores", icon: Truck, group: "Comercial" },

  // FINANZAS
  { href: "/conciliacion", label: "Bancos", icon: Landmark, group: "Finanzas" },
  { href: "/gastos", label: "Gastos", icon: ReceiptText, group: "Finanzas", roles: ["ADMIN", "AUDITOR"] },
  { href: "/consignaciones", label: "Traslados", icon: Camera, group: "Finanzas" },

  // CONFIGURACIÓN
  { href: "/opticas", label: "Ópticas", icon: Store, group: "Configuración", roles: ["ADMIN"] },
  { href: "/usuarios", label: "Usuarios", icon: Users, group: "Configuración", roles: ["ADMIN"] },
  { href: "/bitacora", label: "Logs movimientos", icon: ScrollText, group: "Configuración", roles: ["ADMIN"] },

  // RRHH
  { href: "/empleados", label: "Empleados", icon: UserCog, group: "RRHH", roles: ["ADMIN"] },
];

export const NAV_GROUPS = [
  "Auditoría",
  "Reportes",
  "Comercial",
  "Finanzas",
  "Configuración",
  "RRHH",
] as const;
