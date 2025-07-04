import { describe, it, expect } from "vitest";
import { canonicalize } from "../src/core/hash";

describe("canonicalize", () => {
  it("orders object keys lexicographically", () => {
    const result = canonicalize({ b: 1, a: 2 });
    expect(result).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("throws on circular references", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    expect(() => canonicalize(obj)).toThrow("circular");
  });
});
