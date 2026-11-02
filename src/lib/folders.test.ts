import { describe, expect, it } from "vitest";
import { childFolders, joinPath, normalizePath, parentPath, pathName } from "./folders";

describe("normalizePath", () => {
  it("trims, drops empty segments, and strips edge slashes", () => {
    expect(normalizePath("  JAPAN // JSON / Tobira I ")).toBe("JAPAN/JSON/Tobira I");
    expect(normalizePath(" / ")).toBe("");
    expect(normalizePath("")).toBe("");
  });
});

describe("joinPath", () => {
  it("builds nested paths and handles the root", () => {
    expect(joinPath("JAPAN", "JSON/Tobira I")).toBe("JAPAN/JSON/Tobira I");
    expect(joinPath("", "N5 Kanji")).toBe("N5 Kanji");
    expect(joinPath("JAPAN", "  ")).toBe("JAPAN");
  });
});

describe("parentPath and pathName", () => {
  it("splits a path into parent and name", () => {
    expect(parentPath("JAPAN/JSON/Tobira I")).toBe("JAPAN/JSON");
    expect(parentPath("JAPAN")).toBe("");
    expect(pathName("JAPAN/JSON/Tobira I")).toBe("Tobira I");
    expect(pathName("JAPAN")).toBe("JAPAN");
  });
});

describe("childFolders", () => {
  const paths = [
    "JAPAN/JSON/Tobira I", "JAPAN/JSON/Tobira II", "JAPAN/Vocab", "N5 Kanji", "japan/json/tobira i",
  ];

  it("returns the direct children of a folder, deduped and A → Z", () => {
    expect(childFolders(paths, "JAPAN")).toEqual(["JAPAN/JSON", "JAPAN/Vocab"]);
    expect(childFolders(paths, "JAPAN/JSON")).toEqual(["JAPAN/JSON/Tobira I", "JAPAN/JSON/Tobira II"]);
  });

  it("lists root folders for the empty path", () => {
    expect(childFolders(paths, "")).toEqual(["JAPAN", "N5 Kanji"]);
  });

  it("matches case-insensitively so duplicates collapse", () => {
    expect(childFolders(["N5", "N5/Kanji", "n5/KANJI"], "n5")).toEqual(["n5/Kanji"]);
    expect(childFolders(paths, "missing")).toEqual([]);
  });
});
