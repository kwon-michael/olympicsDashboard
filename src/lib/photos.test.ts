import { describe, expect, it } from "vitest";
import {
  DISPLAY_MAX_EDGE,
  MAX_UPLOAD_BYTES,
  THUMB_MAX_EDGE,
  fitWithin,
  photoPaths,
  rejectionReason,
} from "@/lib/photos";

describe("fitWithin", () => {
  it("scales a landscape photo down by its longest edge", () => {
    expect(fitWithin(4000, 3000, DISPLAY_MAX_EDGE)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("scales a portrait photo by its longest edge too", () => {
    expect(fitWithin(3000, 4000, DISPLAY_MAX_EDGE)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("leaves an image that already fits alone", () => {
    // Blowing a small photo up would cost bytes and add nothing.
    expect(fitWithin(800, 600, DISPLAY_MAX_EDGE)).toEqual({
      width: 800,
      height: 600,
    });
    expect(fitWithin(THUMB_MAX_EDGE, 100, THUMB_MAX_EDGE)).toEqual({
      width: THUMB_MAX_EDGE,
      height: 100,
    });
  });

  it("keeps a sliver of an extreme panorama rather than rounding it away", () => {
    // A 0px canvas throws, so the short edge floors at 1.
    const { width, height } = fitWithin(12000, 3, THUMB_MAX_EDGE);
    expect(width).toBe(THUMB_MAX_EDGE);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("preserves the aspect ratio within a pixel", () => {
    const { width, height } = fitWithin(4032, 3024, DISPLAY_MAX_EDGE);
    expect(Math.abs(width / height - 4032 / 3024)).toBeLessThan(0.01);
  });
});

describe("rejectionReason", () => {
  const jpeg = { type: "image/jpeg", size: 2 * 1024 * 1024 };

  it("accepts an ordinary phone photo", () => {
    expect(rejectionReason(jpeg)).toBeNull();
  });

  it("accepts what an iPhone shoots", () => {
    expect(rejectionReason({ type: "image/heic", size: 3_000_000 })).toBeNull();
  });

  it("turns away things that aren't images", () => {
    expect(rejectionReason({ type: "video/mp4", size: 1000 })).toMatch(/image/i);
    expect(rejectionReason({ type: "application/pdf", size: 1000 })).toMatch(
      /image/i
    );
  });

  it("turns away a file past the size limit, and says how big it was", () => {
    const reason = rejectionReason({
      type: "image/jpeg",
      size: MAX_UPLOAD_BYTES + 1,
    });
    expect(reason).toMatch(/25MB limit/);
  });

  it("accepts a file exactly on the limit", () => {
    expect(
      rejectionReason({ type: "image/jpeg", size: MAX_UPLOAD_BYTES })
    ).toBeNull();
  });

  it("turns away an empty file", () => {
    expect(rejectionReason({ type: "image/jpeg", size: 0 })).toMatch(/empty/i);
  });
});

describe("photoPaths", () => {
  it("keeps both renditions together under the row id", () => {
    const paths = photoPaths("abc-123");
    expect(paths.display).toBe("abc-123/display.jpg");
    expect(paths.thumb).toBe("abc-123/thumb.jpg");
  });

  it("gives every photo a distinct pair", () => {
    expect(photoPaths("one").display).not.toBe(photoPaths("two").display);
  });
});
