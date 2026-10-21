import { describe, expect, it } from "vitest";
import { parseIntent, parseVisitTime } from "./intent";

// 2026-10-21 15:00 Tehran (Wednesday) = 11:30 UTC
const NOW = new Date("2026-10-21T11:30:00Z");
const tehranHour = (d: Date) => ((d.getUTCHours() * 60 + d.getUTCMinutes() + 210) / 60) % 24;

describe("parseIntent", () => {
  it("drops conversational filler and keeps the product", () => {
    const r = parseIntent("شارژر اصلی آیفون ۲۰ وات، الان کجا برم که مطمئن باشم داره؟", NOW);
    expect(r.query).toBe("شارژر آیفون 20 وات");
    expect(r.filters.openOnArrival).toBe(true);
    expect(r.filters.priority).toBe("surest");
    expect(r.wantsWhere).toBe(true);
  });
  it("parses budgets: ceilings, bare ranges and slang", () => {
    expect(parseIntent("هندزفری تا ۳ میلیون", NOW).filters.maxPrice).toBe(3_000_000);
    const range = parseIntent("۶۰ تا ۱۲۰ میلیون", NOW);
    expect(range.filters).toMatchObject({ minPrice: 60_000_000, maxPrice: 120_000_000 });
    expect(range.query).toBe("");
    expect(parseIntent("گوشی زیر ۲۰ تومن", NOW).filters.maxPrice).toBe(20_000_000);
    expect(parseIntent("ساعت حدود ۵ میلیون", NOW).filters).toMatchObject({ minPrice: 3_500_000, maxPrice: 6_000_000 });
  });
  it("understands installments, warranty and places", () => {
    const r = parseIntent("گوشی سامسونگ قسطی با گارانتی نزدیک ونک", NOW);
    expect(r.filters).toMatchObject({ installment: true, warranty: true });
    expect(r.place?.name).toBe("ونک");
    expect(r.query).toBe("گوشی سامسونگ");
  });
  it("keeps words inside words intact", () => {
    expect(parseIntent("هندزفری بلوتوثی", NOW).query).toBe("هندزفری بلوتوثی");
  });
});

describe("parseVisitTime", () => {
  it("reads tonight 8pm", () => {
    const v = parseVisitTime("میخوام ساعت ۸ شب برم خرید", NOW)!;
    expect(tehranHour(v.at)).toBe(20);
    expect(v.at.getUTCDate()).toBe(21);
  });
  it("reads tomorrow morning and weekday names", () => {
    const v = parseVisitTime("فردا صبح", NOW)!;
    expect(tehranHour(v.at)).toBe(10);
    expect(v.label).toContain("فردا");
    const thu = parseVisitTime("پنجشنبه عصر", NOW)!;
    expect(tehranHour(thu.at)).toBe(17);
    expect(thu.at.getUTCDate()).toBe(22);
  });
  it("rolls a past hour to tomorrow and treats bare small hours as afternoon", () => {
    expect(parseVisitTime("ساعت ۱۰ صبح", NOW)!.label).toContain("فردا");
    expect(tehranHour(parseVisitTime("ساعت ۶", NOW)!.at)).toBe(18);
  });
  it("returns null without time words", () => {
    expect(parseVisitTime("گوشی سامسونگ", NOW)).toBeNull();
  });
});
