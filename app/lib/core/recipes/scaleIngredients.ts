export function computePortionsAndScale(input: {
  baseServings: number | null;
  targetPortions?: number | null;
}) {
  const { baseServings, targetPortions } = input;
  const portions = targetPortions ?? baseServings ?? 1;
  const scale = baseServings && baseServings > 0 ? portions / baseServings : 1;
  return { portions, scale };
}

export function formatScaledQuantity(
  q: number | null,
  u: string | null,
  scale: number
) {
  if (q == null) return "—";
  const scaled = q * scale;
  const val =
    scaled >= 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled * 100) / 100;
  return u ? `${val} ${u}` : `${val}`;
}


