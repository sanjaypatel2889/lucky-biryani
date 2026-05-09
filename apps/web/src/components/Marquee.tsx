// Pure-CSS infinite marquee. Duplicate the children, animate -50%.

export function Marquee({ items, className = '' }: { items: React.ReactNode[]; className?: string }) {
  const row = (
    <div className="flex shrink-0 items-center gap-12 px-6">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-12 whitespace-nowrap">
          {it}
          <span className="text-gold/70">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`mask-fade-x overflow-hidden ${className}`}>
      <div className="flex w-max animate-marquee">
        {row}
        {row}
      </div>
    </div>
  );
}
