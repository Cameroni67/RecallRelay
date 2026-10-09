export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">{title}</h1>{description && <p className="mt-1.5 max-w-xl text-[12px] leading-5 text-muted">{description}</p>}</div>{action}</div>;
}
