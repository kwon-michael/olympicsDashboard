import { describe, expect, it } from "vitest";
import {
  extractPhotoUrls,
  readJpegSize,
  sizedUrl,
  sourceIdFor,
} from "@/lib/googlePhotos";

const PHOTO_A =
  "https://lh3.googleusercontent.com/pw/AP1GczM_PyNtEChQ6VchoKecBWTUcXM8rcVrigxoNCl2";
const PHOTO_B =
  "https://lh3.googleusercontent.com/pw/AP1GczM2QWdy6Ed5D8q78s5W0Xzrm0VdgwANQ2WSxmd0";

describe("extractPhotoUrls", () => {
  it("pulls photo URLs out of the share page", () => {
    expect(extractPhotoUrls(`junk "${PHOTO_A}" more \\"${PHOTO_B}\\" junk`)).toEqual(
      [PHOTO_A, PHOTO_B]
    );
  });

  it("keeps the album's order", () => {
    expect(extractPhotoUrls(`${PHOTO_B} ${PHOTO_A}`)).toEqual([PHOTO_B, PHOTO_A]);
  });

  it("deduplicates — a photo appears more than once on the page", () => {
    // The album cover is also one of the photos in the grid.
    expect(extractPhotoUrls(`${PHOTO_A} ${PHOTO_B} ${PHOTO_A}`)).toEqual([
      PHOTO_A,
      PHOTO_B,
    ]);
  });

  it("ignores avatars and other images on the same host", () => {
    const avatar = "https://lh3.googleusercontent.com/a/ACg8ocKprofilepic";
    const other = "https://lh3.googleusercontent.com/proxy/somethingelse";
    expect(extractPhotoUrls(`${avatar} ${PHOTO_A} ${other}`)).toEqual([PHOTO_A]);
  });

  it("returns nothing for a page with no photos", () => {
    expect(extractPhotoUrls("<html><body>nothing here</body></html>")).toEqual([]);
  });
});

describe("sourceIdFor", () => {
  it("identifies a photo by its own token", () => {
    expect(sourceIdFor(PHOTO_A)).toBe("AP1GczM_PyNtEChQ6VchoKecBWTUcXM8rcVrigxoNCl2");
  });

  it("tells two photos apart", () => {
    expect(sourceIdFor(PHOTO_A)).not.toBe(sourceIdFor(PHOTO_B));
  });

  it("is stable across calls, so a re-import skips what it already has", () => {
    expect(sourceIdFor(PHOTO_A)).toBe(sourceIdFor(PHOTO_A));
  });
});

describe("sizedUrl", () => {
  it("asks Google for a rendition rather than the original", () => {
    expect(sizedUrl(PHOTO_A, 1600)).toBe(`${PHOTO_A}=w1600`);
    expect(sizedUrl(PHOTO_A, 480)).toBe(`${PHOTO_A}=w480`);
  });
});

describe("readJpegSize", () => {
  /** A JPEG header carrying one frame marker of the given kind. */
  const jpegWith = (marker: number, width: number, height: number) =>
    new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4 — skipped
      0xff, marker, 0x00, 0x11, 0x08,
      (height >> 8) & 0xff, height & 0xff,
      (width >> 8) & 0xff, width & 0xff,
    ]);

  it("reads the dimensions off a baseline JPEG", () => {
    expect(readJpegSize(jpegWith(0xc0, 1600, 1067))).toEqual({
      width: 1600,
      height: 1067,
    });
  });

  it("reads a progressive JPEG too", () => {
    // Google serves progressive JPEGs for some renditions (SOF2, not SOF0).
    expect(readJpegSize(jpegWith(0xc2, 480, 320))).toEqual({
      width: 480,
      height: 320,
    });
  });

  it("skips over segments on the way to the frame header", () => {
    // The EXIF block sits between SOI and the frame, and is longer than both.
    expect(readJpegSize(jpegWith(0xc0, 4032, 3024))).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it("returns null for something that isn't a JPEG", () => {
    expect(readJpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegSize(new Uint8Array([]))).toBeNull();
  });

  it("returns null rather than guessing when the file is truncated", () => {
    expect(readJpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xc0]))).toBeNull();
  });

  it("gives up at the image data if no frame header was found", () => {
    // SOS with no preceding SOF — malformed, and must not loop forever.
    const noFrame = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]);
    expect(readJpegSize(noFrame)).toBeNull();
  });

  it("doesn't hang on a segment claiming an impossible length", () => {
    const badLength = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff]);
    expect(readJpegSize(badLength)).toBeNull();
  });
});
