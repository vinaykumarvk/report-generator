type NavItem = {
  href: string;
  label: string;
  className?: string;
};

type TopNavProps = {
  items: NavItem[];
  className?: string;
  linkClassName?: string;
};

export default function TopNav({ items, className, linkClassName }: TopNavProps) {
  return (
    <nav className={className}>
      <a 
        href="/" 
        className="nav-brand"
      >
        Report Generator
      </a>
      {items.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          className={item.className || linkClassName}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
