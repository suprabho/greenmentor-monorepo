import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "./csv";

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    // The real case: "Karuna Kalra, Maitri Desai, Shriya Singh" is ONE cell.
    expect(parseCsv('a,"x, y, z",b')).toEqual([["a", "x, y, z", "b"]]);
  });

  it('treats "" inside a quoted field as a literal quote', () => {
    expect(parseCsv('a,"say ""hi""",b')).toEqual([["a", 'say "hi"', "b"]]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('a,"one\ntwo"\nb,c')).toEqual([
      ["a", "one\ntwo"],
      ["b", "c"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops blank lines, including a trailing newline", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a leading BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")[0][0]).toBe("a");
  });

  it("preserves empty trailing cells", () => {
    expect(parseCsv("a,,c,")).toEqual([["a", "", "c", ""]]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsvRecords", () => {
  it("keys cells by header and trims them", () => {
    expect(parseCsvRecords("Name, Price \n Zed ,999")).toEqual([
      { Name: "Zed", Price: "999" },
    ]);
  });

  it("fills missing trailing columns with empty strings", () => {
    expect(parseCsvRecords("a,b,c\n1,2")).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("returns nothing when there is no header", () => {
    expect(parseCsvRecords("")).toEqual([]);
  });
});
