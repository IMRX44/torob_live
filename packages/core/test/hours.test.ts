import { describe, expect, it } from "vitest";
import { openStatusAt, parseWeeklyHours, minutesUntilClose } from "../src/hours";

const day = (status: string, shifts: [string, string][]) => ({
  status,
  shifts: shifts.map(([s, e]) => ({ start_time: s, end_time: e })),
});
const raw = {
  sat: day("declared", [["10:00:00", "19:00:00"], ["00:00:00", "00:00:00"]]),
  sun: day("declared", [["10:00:00", "14:00:00"], ["16:00:00", "21:00:00"]]),
  mon: day("declared", [["18:00:00", "02:00:00"]]),
  tue: day("unsupported", [["00:00:00", "00:00:00"]]),
  wed: day("declared", [["10:00:00", "19:00:00"]]),
  thu: day("declared", [["10:00:00", "14:00:00"]]),
  fri: day("closed", [["00:00:00", "00:00:00"]]),
};
// Tehran = UTC+3:30. 2026-10-24 is a Saturday.
const at = (iso: string) => new Date(iso);

describe("hours", () => {
  const h = parseWeeklyHours(JSON.stringify(raw));
  it("drops placeholder shifts", () => {
    expect(h.known).toBe(true);
    expect(h.days.sat).toEqual([{ start: 600, end: 1140 }]);
    expect(h.days.tue).toBeNull();
    expect(h.days.fri).toEqual([]);
  });
  it("open / closed / next opening", () => {
    expect(openStatusAt(h, at("2026-10-24T08:30:00Z")).state).toBe("open"); // sat 12:00
    const lunch = openStatusAt(h, at("2026-10-25T11:30:00Z")); // sun 15:00
    expect(lunch).toMatchObject({ state: "closed", opensAt: { day: "sun", minutes: 960, inDays: 0 } });
    const fri = openStatusAt(h, at("2026-10-30T08:30:00Z")); // fri 12:00
    expect(fri).toMatchObject({ state: "closed", opensAt: { day: "sat", inDays: 1 } });
    expect(openStatusAt(h, at("2026-10-27T08:30:00Z")).state).toBe("unknown"); // tue
  });
  it("handles overnight shifts", () => {
    const tueEarly = openStatusAt(h, at("2026-10-26T21:30:00Z")); // tue 01:00
    expect(tueEarly).toMatchObject({ state: "open", closesAt: 120 });
    expect(minutesUntilClose(h, at("2026-10-26T21:30:00Z"))).toBe(60);
  });
  it("treats all-closed weeks as undeclared", () => {
    const none = parseWeeklyHours(Object.fromEntries(Object.keys(raw).map((k) => [k, day("closed", [])])));
    expect(none.known).toBe(false);
    expect(openStatusAt(none, new Date()).state).toBe("unknown");
  });
});
