import { describe, expect, it } from "vitest";
import { normalizeFa, tokenize, toPersianDigits } from "../src/text";
import { formatToman, formatAgo } from "../src/format";

describe("normalizeFa", () => {
  it("unifies arabic letters, digits and zwnj", () => {
    expect(normalizeFa("كيف‌پول ۲٫۵")).toBe("کیف پول 2.5");
    expect(normalizeFa("علاءالدین")).toBe(normalizeFa("علاالدین"));
    expect(normalizeFa("  iPhone  ۱۵ ")).toBe("iphone 15");
  });
  it("drops stop words in tokenize", () => {
    expect(tokenize("یه هندزفری برای باشگاه میخوام")).toEqual(["هندزفری", "باشگاه"]);
  });
});

describe("format", () => {
  it("formats toman compactly", () => {
    expect(formatToman(42_500_000)).toBe("۴۲٫۵ میلیون تومان");
    expect(formatToman(850_000)).toBe("۸۵۰٬۰۰۰ تومان");
    expect(formatToman(null)).toBe("بدون قیمت");
  });
  it("formats relative time", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(formatAgo("2026-10-18T12:00:00Z", now)).toBe("۳ روز پیش");
    expect(toPersianDigits(120)).toBe("۱۲۰");
  });
});
