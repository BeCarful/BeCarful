const ICONS = {
  camera: ["...###....", ".########.", ".#......#.", ".#..##..#.", ".#.#..#.#.", ".#.#..#.#.", ".#..##..#.", ".#......#.", ".########.", ".........."],
  upload: ["....##....", "...####...", "..######..", "....##....", "....##....", "....##....", "#...##...#", "#........#", "##########", ".........."],
  policy: [".########.", ".#......#.", ".#.####.#.", ".#......#.", ".#.####.#.", ".#......#.", ".#.###..#.", ".#......#.", ".########.", ".........."],
  pin: ["...####...", "..#....#..", ".#..##..#.", ".#..##..#.", "..#....#..", "..#....#..", "...#..#...", "....##....", "....##....", ".........."],
  alert: ["....##....", "....##....", "....##....", "....##....", "....##....", "....##....", "..........", "....##....", "....##....", ".........."],
} satisfies Record<string, string[]>;

export type PixelIconName = keyof typeof ICONS;

const paths = Object.fromEntries(
  Object.entries(ICONS).map(([name, rows]) => [
    name,
    rows.flatMap((row, y) => [...row].map((c, x) => (c === "#" ? `M${x} ${y}h1v1h-1z` : ""))).join(""),
  ]),
) as Record<PixelIconName, string>;

export function PixelIcon({ name, className = "size-5" }: { name: PixelIconName; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
