export type NavItem = {
  href: string;
  label: string;
  className?: string;
};

export const defaultNavItems: NavItem[] = [
  { href: "/template-studio", label: "Reports Studio" },
  { href: "/runs", label: "Runs" },
];

export const templateStudioNavItems: NavItem[] = [
  { href: "/runs", label: "View Runs" },
];
