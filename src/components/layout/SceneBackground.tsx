const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 55,
  delay: (i % 7) * 0.4,
}));

/** Pixel sky behind every screen: clouds by day, stars and moon at night. */
export function SceneBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-(--sky-top) to-(--sky-bottom)">
      <div className="absolute inset-0 dark:hidden">
        <div className="pixel-cloud left-[8%] top-[14%] scale-150" />
        <div className="pixel-cloud left-[62%] top-[22%]" />
        <div className="pixel-cloud left-[35%] top-[9%] scale-75 opacity-80" />
        <div className="absolute right-[10%] top-24 size-12 bg-[#ffe066] shadow-[0_0_0_4px_#ffd23f] max-sm:top-[72px] max-sm:right-3 max-sm:size-7" />
      </div>
      <div className="absolute inset-0 hidden dark:block">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute size-1 animate-pulse bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
          />
        ))}
        <div className="absolute right-[12%] top-24 size-12 bg-[#f4f1de] shadow-[inset_-10px_-4px_0_#c9c5a8] max-sm:top-[72px] max-sm:right-3 max-sm:size-7 max-sm:shadow-[inset_-6px_-3px_0_#c9c5a8]" />
      </div>
    </div>
  );
}
