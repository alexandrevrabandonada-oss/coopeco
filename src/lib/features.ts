export function isPilotFeatureEnabled(): boolean {
  const raw = process.env.ECO_FEATURES_PILOT ?? process.env.NEXT_PUBLIC_ECO_FEATURES_PILOT ?? "false";
  return raw.toLowerCase() === "true";
}

export function isAnchorsFeatureEnabled(): boolean {
  const raw = process.env.ECO_FEATURES_ANCHORS ?? process.env.NEXT_PUBLIC_ECO_FEATURES_ANCHORS ?? "false";
  return raw.toLowerCase() === "true";
}

export function isGalpaoFeatureEnabled(): boolean {
  const raw = process.env.ECO_FEATURES_GALPAO ?? process.env.NEXT_PUBLIC_ECO_FEATURES_GALPAO ?? "false";
  return raw.toLowerCase() === "true";
}

export function isGovFeatureEnabled(): boolean {
  const raw = process.env.ECO_FEATURES_GOV ?? process.env.NEXT_PUBLIC_ECO_FEATURES_GOV ?? "false";
  return raw.toLowerCase() === "true";
}

export function isLearnFeatureEnabled(): boolean {
  const raw = process.env.ECO_FEATURES_LEARN ?? process.env.NEXT_PUBLIC_ECO_FEATURES_LEARN ?? "false";
  return raw.toLowerCase() === "true";
}
