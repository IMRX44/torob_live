import { normalizeFa } from "./text";

/**
 * PC-part compatibility from listing titles (the dataset has no structured socket fields).
 * Covers mainstream desktop Intel (LGA1155 → LGA1700) and AMD (AM4/AM5) parts.
 */

export type Socket = "LGA1155" | "LGA1150" | "LGA1151" | "LGA1151v2" | "LGA1200" | "LGA1700" | "LGA1851" | "LGA2066" | "AM4" | "AM5";
export type Ddr = "DDR3" | "DDR4" | "DDR5";

const CHIPSET: [RegExp, Socket][] = [
  [/\b(?:h61|b75|h77|z77|z75|q77)[a-z]{0,3}\b/, "LGA1155"],
  [/\b(?:h81|b85|h87|z87|h97|z97|q87)[a-z]{0,3}\b/, "LGA1150"],
  [/\b(?:h110|b150|h170|z170|b250|h270|z270|q270)[a-z]{0,3}\b/, "LGA1151"],
  [/\b(?:h310|b360|b365|h370|z370|z390|q370)[a-z]{0,3}\b/, "LGA1151v2"],
  [/\b(?:h410|b460|h470|z490|h510|b560|h570|z590|w480)[a-z]{0,3}\b/, "LGA1200"],
  [/\b(?:h610|b660|h670|z690|b760|z790|h770)[a-z]{0,3}\b/, "LGA1700"],
  [/\b(?:z890|b860|h810)[a-z]{0,3}\b/, "LGA1851"],
  [/\b(?:x299)[a-z]{0,3}\b/, "LGA2066"],
  [/\b(?:a320|b350|x370|b450|x470|a520|b550|x570)[a-z]{0,3}\b/, "AM4"],
  [/\b(?:a620|b650|x670|b840|b850|x870)[a-z]{0,3}\b/, "AM5"],
];

const EXPLICIT: [RegExp, Socket][] = [
  [/lga\s?1851/, "LGA1851"],
  [/lga\s?1700/, "LGA1700"],
  [/lga\s?1200/, "LGA1200"],
  [/lga\s?1151/, "LGA1151"],
  [/lga\s?1150/, "LGA1150"],
  [/lga\s?1155/, "LGA1155"],
  [/lga\s?2066/, "LGA2066"],
  [/\bam5\b/, "AM5"],
  [/\bam4\b/, "AM4"],
];

const t = (s: string) => normalizeFa(s).replace(/[-_]/g, " ");

export function boardSocket(title: string): Socket | null {
  const s = t(title);
  for (const [re, sock] of CHIPSET) if (re.test(s)) return sock;
  for (const [re, sock] of EXPLICIT) if (re.test(s)) return sock;
  return null;
}

export function cpuSocket(title: string): Socket | null {
  const s = t(title);
  for (const [re, sock] of EXPLICIT) if (re.test(s)) return sock;
  // Intel Core: i5 9400f, i7 12700k, core ultra 5 245k
  if (/core\s*ultra|\bultra\s*[579]\s*2\d\d/.test(s)) return "LGA1851";
  const intel = s.match(/\bi[3579]\s?(\d{4,5})[a-z]{0,2}\b/);
  if (intel) {
    const n = intel[1]!;
    if (n.length === 5) {
      const g = Number(n.slice(0, 2));
      if (g === 10 || g === 11) return "LGA1200";
      if (g >= 12 && g <= 14) return "LGA1700";
      return null;
    }
    const g = Number(n[0]);
    if (g === 2 || g === 3) return "LGA1155";
    if (g === 4 || g === 5) return "LGA1150";
    if (g === 6 || g === 7) return "LGA1151";
    if (g === 8 || g === 9) return "LGA1151v2";
  }
  // AMD Ryzen: ryzen 5 5600x, ryzen 7 7800x3d
  const amd = s.match(/ryzen\s?[3579]\s?(\d{4})/);
  if (amd) {
    const g = Number(amd[1]![0]);
    if (g >= 1 && g <= 5) return "AM4";
    if (g >= 7) return "AM5";
  }
  return null;
}

export function ddrOf(title: string): Ddr | null {
  const m = t(title).match(/\bd(?:dr)?\s?([345])\b|ddr([345])/);
  const v = m?.[1] ?? m?.[2];
  return v ? (`DDR${v}` as Ddr) : null;
}

/** RAM generation a board needs, when the title doesn't say it. */
export function boardDdr(title: string): Ddr | null {
  const explicit = ddrOf(title);
  if (explicit) return explicit;
  const sock = boardSocket(title);
  if (sock === "AM5" || sock === "LGA1851") return "DDR5";
  if (sock === "LGA1155" || sock === "LGA1150") return "DDR3";
  if (sock && sock !== "LGA1700") return "DDR4"; // LGA1700 boards exist in both flavours
  return null;
}

/** true = compatible, false = certainly not, null = can't tell from the titles. */
export function cpuBoardCompatible(cpuTitle: string, boardTitle: string): boolean | null {
  const c = cpuSocket(cpuTitle);
  const b = boardSocket(boardTitle);
  if (!c || !b) return null;
  return c === b;
}

export function ramBoardCompatible(ramTitle: string, boardTitle: string): boolean | null {
  const r = ddrOf(ramTitle);
  const b = boardDdr(boardTitle);
  if (!r || !b) return null;
  return r === b;
}
