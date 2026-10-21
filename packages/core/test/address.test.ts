import { describe, expect, it } from "vitest";
import { parseAddress, parseFloor, mallKeyOf } from "../src/address";

describe("parseAddress", () => {
  it.each([
    ["خیابان جمهوری، نبش شیخ هادی، پاساژ علالدین 2، طبقه 6، واحد 622", "پاساژ علالدین 2", 6, "622"],
    ["خیابان لاله‌زار جنوبی، نبش مجمر، پاساژ فراز، طبقه همکف، پلاک ۲۸", "پاساژ فراز", 0, "28"],
    ["جمهوری اسلامی، تقاطع حافظ و جمهوری، پاساط چارسو، طبقه اول، پلاک ۵۸", "پاساژ چارسو", 1, "58"],
    ["خیابان فردوسی، ساختمان پلاسکو، طبقه بالای همکف، روبروی پله برقی، پلاک ۱۵۵", "ساختمان پلاسکو", 1, "155"],
    ["میدان تجریش، پاساژ قائم، طبقه ۵، پلاک ۲۱۷۵/۹", "پاساژ قائم", 5, "2175/9"],
    ["سعادت‌آباد، مجتمع تجاری اپال، طبقه ۷، پلاک ۷۲۰", "مجتمع تجاری اپال", 7, "720"],
  ])("%s", (addr, mall, floor, unit) => {
    const p = parseAddress(addr);
    expect(p.mallName).toBe(mall);
    expect(p.floor).toBe(floor);
    expect(p.unit).toBe(unit);
  });

  it("ignores malls that are only landmarks", () => {
    const p = parseAddress("خیابان جمهوری اسلامی، نرسیده به پاساژ علاالدین، نبش پاساژ بزرگمهر، پلاک ۶۷۶");
    expect(p.mallName).toBeNull();
    expect(p.unit).toBe("676");
  });

  it("parses basement floors", () => {
    expect(parseFloor("طبقه منفی یک")).toBe(-1);
    expect(parseFloor("طبقه ۱-")).toBe(-1);
    expect(parseFloor("طبقه زیر همکف")).toBe(-1);
    expect(parseFloor("طبقه منفی ۲")).toBe(-2);
  });

  it("merges mall spelling variants", () => {
    const keys = ["پاساژ علاالدین", "پاساژ علاءالدین", "پاساژ علائدین"].map(mallKeyOf);
    expect(new Set(keys).size).toBe(1);
    expect(mallKeyOf("پاساژ علاالدین ۲")).toBe("علاالدین 2");
    expect(mallKeyOf("پاساژ چهارسو")).toBe(mallKeyOf("پاساژ چارسو"));
  });
});

describe("mall keys", () => {
  it("drops street suffixes", () => {
    expect(mallKeyOf("پاساژ فراز لاله زار")).toBe(mallKeyOf("پاساژ فراز"));
    expect(mallKeyOf("مجتمع تجارت جهانی فردوسی")).toBe(mallKeyOf("پاساژ تجارت جهانی"));
    expect(mallKeyOf("پاساژ سرای لاله زار")).toBe("لاله زار");
  });
});
