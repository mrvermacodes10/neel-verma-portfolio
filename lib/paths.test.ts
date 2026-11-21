import { describe, expect, it } from "vitest";
import { isValidObjectPath, newObjectName } from "./paths";

describe("storage paths", () => {
  it("accepts only the two allowed layouts", () => {
    expect(isValidObjectPath("profile/abc123.webp")).toBe(true);
    expect(isValidObjectPath("projects/0b6a6a1e-1a2b-4c3d-8e9f-001122334455/" + newObjectName())).toBe(true);
    for (const bad of ["../etc/passwd", "profile/../x.webp", "projects/not-a-uuid/x.webp", "profile/x.svg", "profile/a b.webp", "other/x.webp", "profile/", "projects/0b6a6a1e-1a2b-4c3d-8e9f-001122334455/sub/x.webp"])
      expect(isValidObjectPath(bad)).toBe(false);
  });
});
