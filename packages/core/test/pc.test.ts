import { describe, expect, it } from "vitest";
import { boardDdr, boardSocket, cpuBoardCompatible, cpuSocket, ddrOf, ramBoardCompatible } from "../src/pc";

describe("pc compatibility", () => {
  it.each([
    ["پردازنده اینتل Core i5-9400F Coffee Lake", "LGA1151v2"],
    ["پردازنده اینتل Core i5 12400F", "LGA1700"],
    ["Intel Core i7-13700K", "LGA1700"],
    ["پردازنده i3 10100", "LGA1200"],
    ["Core i7 4790", "LGA1150"],
    ["AMD Ryzen 5 5600X", "AM4"],
    ["رایزن Ryzen 7 7800X3D", "AM5"],
  ])("cpu %s", (title, sock) => expect(cpuSocket(title)).toBe(sock));

  it.each([
    ["مادربرد ازراک مدل H110 Pro BTC Plus DDR4", "LGA1151"],
    ["مادربرد گیمینگ msi mpg z390 gaming plus ddr4 استوک", "LGA1151v2"],
    ["مادربرد گیگابایت مدل B760M POWER rev. 1.0", "LGA1700"],
    ["Motherboard amd b450mk asus prime am4", "AM4"],
    ["مادربرد صنعتی j1900 خروجی Gpio", null],
  ])("board %s", (title, sock) => expect(boardSocket(title)).toBe(sock));

  it("matches cpu to board and ram to board", () => {
    expect(cpuBoardCompatible("Core i5-9400F", "msi z390 gaming plus")).toBe(true);
    expect(cpuBoardCompatible("Core i5-9400F", "ASRock H110 Pro")).toBe(false);
    expect(cpuBoardCompatible("Core i5-9400F", "مادربرد صنعتی j1900")).toBeNull();
    expect(ddrOf("رم کامپیوتر کینگستون DDR4 3200")).toBe("DDR4");
    expect(boardDdr("asus prime h610ma wifi ddr5")).toBe("DDR5");
    expect(boardDdr("asus tuf gaming b460 plus")).toBe("DDR4");
    expect(ramBoardCompatible("رم DDR3 1600", "msi z390")).toBe(false);
  });
});
