export type NavItem = {
  href: string;
  label: string;
  className?: string;
};

export const defaultNavItems: NavItem[] = [
  { href: "/template-studio", label: "Objective Studio" },
  { href: "/runs", label: "Runs" },
  { href: "/connectors", label: "Sources" },
  { href: "/models", label: "Model Configs" },
  { href: "/prompts", label: "Prompt Studio" },
  { href: "/evidence", label: "Evidence" },
  { href: "/exports", label: "Exports" },
  { href: "/settings", label: "Settings" },
];

export const templateStudioNavItems: NavItem[] = [
  { href: "/connectors", label: "Open Sources" },
  { href: "/models", label: "Open Model Configs" },
  { href: "/prompts", label: "Prompt Studio" },
  { href: "/evidence", label: "Evidence Viewer" },
  { href: "/exports", label: "Export Viewer" },
  { href: "/settings", label: "Admin/Settings" },
  { href: "/api/openapi", label: "OpenAPI" },
];
