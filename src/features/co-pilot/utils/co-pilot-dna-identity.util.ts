export type DnaIdentityUpdateAxis = "palette" | "fonts" | "aesthetics";

const GREEN_TEAL_SUGGESTIONS = [
  "#0D9488",
  "#14B8A6",
  "#2DD4BF",
  "#059669",
  "#34D399",
  "#99F6E4",
  "#064E3B",
  "#134E4A",
];

const KNOWN_FONT_NAMES = [
  "inter",
  "roboto",
  "open sans",
  "system-ui",
  "arial",
  "helvetica",
  "georgia",
  "times new roman",
  "lato",
  "montserrat",
  "poppins",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "source sans",
  "nunito",
  "playfair display",
];

export function isVagueFontName(fontName: string): boolean {
  const normalized = fontName.toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  if (KNOWN_FONT_NAMES.some((font) => normalized === font || normalized.includes(font))) {
    return false;
  }

  const vaguePatterns = [
    /^something\s+/,
    /\bmore\s+(modern|classic|readable|professional)\b/,
    /^(a\s+)?(modern|classic|clean|nice|better)\b/,
    /\b(like|similar|something|anything)\b/,
    /\b(covered by|browsers|devices)\b/,
  ];

  if (vaguePatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return normalized.split(/\s+/).length > 3;
}

export function isDnaIdentityApplyAdvisoryQuery(userText: string): boolean {
  const n = userText.toLowerCase();
  return (
    /\b(update|apply|use|set)\s+(to\s+)?(this|these|those|them)\b/.test(n) ||
    n.includes("update to this") ||
    n.includes("apply these") ||
    n.includes("apply those") ||
    n.includes("use those color") ||
    n.includes("use those colour")
  );
}

export function buildApplyAdvisoryNarrative(): string {
  return [
    "To apply the suggested palette, send the exact hex list — for example:",
    "Change palette to #0D9488, #14B8A6, #059669, #34D399, #F0FDFA",
    "",
    "I will stage it for your review before saving to Brand DNA.",
  ].join("\n");
}

export function isDnaIdentityAdvisoryQuery(userText: string): boolean {
  const n = userText.toLowerCase();
  const wantsAdvice =
    /\b(suggest|recommend|ideas?|what would|help me (pick|choose)|any options)\b/.test(
      n,
    );
  const aboutColors =
    n.includes("color") ||
    n.includes("colour") ||
    n.includes("palette") ||
    n.includes("hex");
  return wantsAdvice && aboutColors;
}

export function isDnaIdentityReadQuery(userText: string): boolean {
  const n = userText.toLowerCase();
  const isRead =
    (/\b(how|what|show|tell|describe|list|talk about|give me|current)\b/.test(
      n,
    ) ||
      n.includes("look like") ||
      n.includes(" looks") ||
      n.endsWith(" look") ||
      n.includes("read-only")) &&
    !/\b(update|change|add|set|apply|restrict)\b/.test(n);

  const hasVisualTopic =
    n.includes("aesthetic") ||
    n.includes("visual") ||
    n.includes("palette") ||
    n.includes("colour") ||
    n.includes("color") ||
    n.includes("font") ||
    n.includes("style");

  return isRead && hasVisualTopic;
}

export function parseDnaIdentityUpdate(userText: string): {
  axes: DnaIdentityUpdateAxis[];
  stagedPayload: Record<string, unknown>;
  missingSlots: Array<{
    fieldName: string;
    uiLabel: string;
    inputType: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "DATE";
    placeholderText: string;
    selectOptions?: string[];
  }>;
} | null {
  const n = userText.toLowerCase();

  if (isDnaIdentityAdvisoryQuery(userText) || isDnaIdentityReadQuery(userText)) {
    return null;
  }

  const hasWriteVerb =
    /\b(update|change|add|set|apply|restrict|switch|use)\b/.test(n) ||
    n.includes("font to") ||
    (n.includes("add ") && (n.includes("look") || n.includes("aesthetic")));

  if (!hasWriteVerb) {
    return null;
  }

  const fontsOnlyHint =
    n.includes("not style") ||
    n.includes("not aesthetic") ||
    (n.includes("only font") || n.includes("just font") || n.includes("but font"));

  let wantsPalette =
    n.includes("palette") ||
    n.includes("color") ||
    n.includes("colour") ||
    n.includes("hex");
  let wantsFonts = n.includes("font");
  let wantsAesthetics =
    (n.includes("aesthetic") ||
      n.includes("minimalist") ||
      n.includes("visual style") ||
      (n.includes("add ") && n.includes("look"))) &&
    !fontsOnlyHint;

  if (fontsOnlyHint) {
    wantsAesthetics = false;
    wantsFonts = true;
  }

  if (n.includes("update visual") && !wantsPalette && !wantsFonts && !wantsAesthetics) {
    wantsAesthetics = true;
    wantsFonts = true;
  }

  if (!wantsPalette && !wantsFonts && !wantsAesthetics) {
    return null;
  }

  const fontMatchRaw =
    userText.match(
      /(?:change|set|switch|use|update)\s+(?:the\s+)?fonts?\s+to\s+([a-zA-Z0-9\s]+)/i,
    )?.[1]?.trim() ??
    userText.match(/fonts?\s+to\s+([a-zA-Z0-9\s]+)/i)?.[1]?.trim();

  const fontMatch =
    fontMatchRaw && !isVagueFontName(fontMatchRaw) ? fontMatchRaw : undefined;

  const aestheticMatch = userText.match(
    /(?:add|apply)\s+(?:a\s+)?(.+?)\s+(?:look|aesthetic|style)/i,
  )?.[1]?.trim();

  const paletteFromMessage = extractHexColors(userText);

  const axes: DnaIdentityUpdateAxis[] = [];
  if (wantsPalette) axes.push("palette");
  if (wantsFonts) axes.push("fonts");
  if (wantsAesthetics) axes.push("aesthetics");

  const stagedPayload: Record<string, unknown> = {
    update_axes: axes,
    primary_font: fontMatch,
    aesthetic_style: aestheticMatch,
    palette_colors: paletteFromMessage.length > 0 ? paletteFromMessage.join(", ") : undefined,
  };

  const missingSlots: Array<{
    fieldName: string;
    uiLabel: string;
    inputType: "TEXT";
    placeholderText: string;
  }> = [];

  if (wantsPalette && paletteFromMessage.length === 0) {
    missingSlots.push({
      fieldName: "palette_colors",
      uiLabel: "Colour palette (hex codes, comma-separated)",
      inputType: "TEXT",
      placeholderText: "e.g. #0D9488, #14B8A6, #059669, #34D399, #F0FDFA",
    });
  }

  if (wantsFonts && !fontMatch) {
    missingSlots.push({
      fieldName: "primary_font",
      uiLabel: "Primary font",
      inputType: "TEXT",
      placeholderText: "e.g. Inter, Georgia, system-ui",
    });
  }

  if (wantsAesthetics && !aestheticMatch) {
    missingSlots.push({
      fieldName: "aesthetic_style",
      uiLabel: "Aesthetic style to add",
      inputType: "TEXT",
      placeholderText: "e.g. Modern minimalist",
    });
  }

  if (missingSlots.length === 0 && axes.length === 0) {
    return null;
  }

  if (axes.length > 0 && missingSlots.length === 0) {
    return { axes, stagedPayload, missingSlots: [] };
  }

  if (axes.length === 0) {
    return null;
  }

  return { axes, stagedPayload, missingSlots };
}

export function extractHexColors(text: string): string[] {
  const matches = text.match(/#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g);
  if (!matches) {
    return [];
  }
  return [...new Set(matches.map((hex) => hex.toUpperCase()))];
}

export function parsePaletteColorsInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [];
  }
  const fromHex = extractHexColors(raw);
  if (fromHex.length > 0) {
    return fromHex;
  }
  return raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function buildPaletteAdvisoryNarrative(brandName: string): string {
  const picks = GREEN_TEAL_SUGGESTIONS.slice(0, 5).join(", ");
  return [
    `Here are clean green–teal palette options that pop for ${brandName}:`,
    picks,
    "",
    "These are suggestions only — nothing changes until you confirm.",
    'To apply, say something like: **Change palette to #0D9488, #14B8A6, #059669, #34D399, #F0FDFA** — I will stage it for your review before saving to Brand DNA.',
  ].join("\n");
}

export function buildDnaIdentityWriteNarrative(axes: DnaIdentityUpdateAxis[]): string {
  const labels = axes.map((axis) => {
    switch (axis) {
      case "palette":
        return "colour palette";
      case "fonts":
        return "fonts";
      case "aesthetics":
        return "aesthetic styles";
      default:
        return axis;
    }
  });

  if (labels.length === 1) {
    return `I can update your Brand DNA ${labels[0]} after you confirm. Review the staged values below — nothing is saved until you approve.`;
  }

  return `I can update your Brand DNA ${labels.join(" and ")} after you confirm. Review the staged values below — nothing is saved until you approve.`;
}

export function refineDnaIdentityClarification(
  userText: string,
  session: {
    stagedPayload: Record<string, unknown>;
    missingSlots: Array<{
      fieldName: string;
      uiLabel: string;
      inputType: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "DATE";
      placeholderText: string;
      selectOptions?: string[];
    }>;
  },
): {
  stagedPayload: Record<string, unknown>;
  missingSlots: typeof session.missingSlots;
} | null {
  const n = userText.toLowerCase();

  const fontsOnly =
    n.includes("not style") ||
    n.includes("not aesthetic") ||
    n.includes("only font") ||
    n.includes("just font") ||
    n.includes("but font") ||
    (n.includes("font") && !n.includes("style") && !n.includes("aesthetic"));

  const paletteOnly =
    n.includes("only palette") ||
    n.includes("just palette") ||
    n.includes("only color") ||
    n.includes("just color") ||
    n.includes("only colour") ||
    n.includes("but palette") ||
    (n.includes("palette") && !n.includes("font") && !n.includes("style"));

  if (!fontsOnly && !paletteOnly) {
    return null;
  }

  const staged = { ...session.stagedPayload };
  const axes: DnaIdentityUpdateAxis[] = [];

  if (paletteOnly) {
    axes.push("palette");
    delete staged.aesthetic_style;
    delete staged.primary_font;
  }

  if (fontsOnly) {
    axes.push("fonts");
    delete staged.aesthetic_style;
  }

  staged.update_axes = axes;

  const missingSlots: typeof session.missingSlots = [];

  if (axes.includes("palette") && !staged.palette_colors) {
    missingSlots.push({
      fieldName: "palette_colors",
      uiLabel: "Colour palette (hex codes, comma-separated)",
      inputType: "TEXT",
      placeholderText: "e.g. #0D9488, #14B8A6, #059669, #34D399, #F0FDFA",
    });
  }

  if (axes.includes("fonts") && !staged.primary_font) {
    const fontMatchRaw =
      userText.match(
        /(?:change|set|switch|use|update)\s+(?:the\s+)?fonts?\s+to\s+([a-zA-Z0-9\s]+)/i,
      )?.[1]?.trim() ??
      userText.match(/fonts?\s+to\s+([a-zA-Z0-9\s]+)/i)?.[1]?.trim();
    const fontMatch =
      fontMatchRaw && !isVagueFontName(fontMatchRaw) ? fontMatchRaw : undefined;
    if (fontMatch) {
      staged.primary_font = fontMatch;
    } else {
      missingSlots.push({
        fieldName: "primary_font",
        uiLabel: "Primary font",
        inputType: "TEXT",
        placeholderText: "e.g. Inter, Georgia, system-ui",
      });
    }
  }

  return { stagedPayload: staged, missingSlots };
}

export function mergeIdentityPatch(args: {
  current: { palette: string[]; fonts: string[]; aesthetics: string[] };
  axes: DnaIdentityUpdateAxis[];
  primaryFont?: string;
  aestheticStyle?: string;
  paletteColors?: string[];
}): { palette?: string[]; fonts?: string[]; aesthetics?: string[] } {
  const patch: { palette?: string[]; fonts?: string[]; aesthetics?: string[] } = {};

  if (args.axes.includes("palette") && args.paletteColors && args.paletteColors.length > 0) {
    patch.palette = args.paletteColors;
  }

  if (args.axes.includes("fonts") && args.primaryFont) {
    const secondary = args.current.fonts[1] ?? args.primaryFont;
    patch.fonts = [args.primaryFont, secondary];
  }

  if (args.axes.includes("aesthetics") && args.aestheticStyle) {
    const merged = [...args.current.aesthetics, args.aestheticStyle];
    patch.aesthetics = [...new Set(merged.map((item) => item.trim()).filter(Boolean))];
  }

  return patch;
}
