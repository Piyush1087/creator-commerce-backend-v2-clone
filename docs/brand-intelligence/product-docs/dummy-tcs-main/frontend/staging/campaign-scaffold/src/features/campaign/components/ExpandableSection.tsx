import type { PropsWithChildren } from "react";

interface ExpandableSectionProps extends PropsWithChildren { title: string; summary: string; expanded: boolean; onToggle: () => void; placeholder?: boolean; }

export function ExpandableSection({ title, summary, expanded, onToggle, placeholder = false, children }: ExpandableSectionProps) {
  return <section className={`expandableSection ${expanded ? "expanded" : ""}`}><button aria-expanded={expanded} className="sectionToggle" onClick={onToggle} type="button"><span><strong>{title}</strong><small>{summary}</small></span><span aria-hidden="true">{expanded ? "−" : "+"}</span></button>{expanded && <div className={`sectionBody ${placeholder ? "placeholderBody" : ""}`}>{children}</div>}</section>;
}
