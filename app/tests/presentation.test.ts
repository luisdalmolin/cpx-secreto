import {
  isValidIsoDate,
  parseBudgetCents,
} from "@/features/editions/presentation";
import {
  formatCurrency,
  formatDate,
  initials,
  parseRouteId,
} from "@/features/shared/presentation";
import { getGreetingKey } from "@/lib/greeting";

describe("shared presentation helpers", () => {
  test("parses only positive integer route identifiers", () => {
    expect(parseRouteId("42")).toBe(42);
    expect(parseRouteId(["7", "8"])).toBe(7);
    expect(parseRouteId("0")).toBeUndefined();
    expect(parseRouteId("1.5")).toBeUndefined();
    expect(parseRouteId(undefined)).toBeUndefined();
  });

  test("creates initials from at most two name parts", () => {
    expect(initials("  ana maria silva ")).toBe("AM");
    expect(initials("Luís")).toBe("L");
    expect(initials("   ")).toBe("");
  });

  test("formats supported currency values", () => {
    expect(formatCurrency(12345)?.replace(/\s/g, " ")).toBe("R$ 123,45");
    expect(formatCurrency(12345, "USD")).toBe("USD 123,45");
    expect(formatCurrency(null)).toBeUndefined();
  });

  test("keeps invalid dates visible and omits empty dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate(null)).toBeUndefined();
  });
});

describe("edition form helpers", () => {
  test("parses Brazilian decimal budget values as cents", () => {
    expect(parseBudgetCents("1.234,56")).toBe(123456);
    expect(parseBudgetCents(" 0 ")).toBe(0);
    expect(parseBudgetCents("")).toBeNull();
    expect(parseBudgetCents("-1,00")).toBeNull();
    expect(parseBudgetCents("invalid")).toBeNull();
  });

  test("accepts only real ISO calendar dates", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("11/08/2026")).toBe(false);
  });
});

describe("greeting selection", () => {
  test.each([
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
  ] as const)("selects the greeting for hour %i", (hour, greeting) => {
    expect(getGreetingKey(new Date(2026, 7, 11, hour))).toBe(greeting);
  });
});
