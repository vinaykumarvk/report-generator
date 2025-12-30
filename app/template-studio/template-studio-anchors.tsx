type AnchorItem = {
  href: string;
  label: string;
};

const anchorItems: AnchorItem[] = [
  { href: "#objectives", label: "Objectives" },
  { href: "#editor", label: "Sections" },
  { href: "#sources", label: "Sources" },
  { href: "#prompts", label: "Prompts" },
  { href: "#runs", label: "Runs" },
];

type TemplateStudioAnchorsProps = {
  className?: string;
  linkClassName?: string;
};

export default function TemplateStudioAnchors({
  className,
  linkClassName,
}: TemplateStudioAnchorsProps) {
  return (
    <div className={className}>
      {anchorItems.map((item) => (
        <a key={item.href} href={item.href} className={linkClassName}>
          {item.label}
        </a>
      ))}
    </div>
  );
}
