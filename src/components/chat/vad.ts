export function silenceDetector({ silenceMs = 1400, noSpeechMs = 8000, speechMs = 250, minLevel = 0.01 } = {}) {
  let floor = Infinity;
  let started: number | null = null;
  let last: number | null = null;
  let spoken = 0;
  let quietFrom: number | null = null;

  return (level: number, now: number): boolean => {
    started ??= now;
    const dt = last === null ? 0 : now - last;
    last = now;
    const loud = level > Math.max(floor * 3, minLevel);
    if (level < floor) floor = level;
    else if (!loud) floor += (level - floor) * 0.05;
    if (loud) {
      spoken += dt;
      quietFrom = null;
      return false;
    }
    quietFrom ??= now;
    return spoken >= speechMs ? now - quietFrom >= silenceMs : now - started >= noSpeechMs;
  };
}
