import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { prepareImage, UnreadablePhotoError } from "./image-prep";

const photo = (width: number, height: number, mean = 128, sigma = 40) =>
  sharp({ create: { width, height, channels: 3, background: { r: mean, g: mean, b: mean }, noise: { type: "gaussian", mean, sigma } } });

test("a sharp, well-lit photo has no issues and is shrunk to a 2048px JPEG", async () => {
  const p = await prepareImage(await photo(3000, 1500).jpeg().toBuffer(), "image/jpeg");
  assert.deepEqual(p.issues, []);
  assert.deepEqual([p.width, p.height], [2048, 1024]);
  assert.equal((await sharp(p.jpeg).metadata()).format, "jpeg");
});

test("EXIF orientation is applied, so Gemini sees the photo upright", async () => {
  const sideways = await photo(1600, 900).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const p = await prepareImage(sideways, "image/jpeg");
  assert.deepEqual([p.width, p.height], [900, 1600]);
  assert.equal((await sharp(p.jpeg).metadata()).orientation, undefined);
});

test("flags dark, bright, blurry and low-resolution photos", async () => {
  const issues = async (img: ReturnType<typeof sharp>) => (await prepareImage(await img.png().toBuffer(), "image/png")).issues;
  assert.deepEqual(await issues(photo(1200, 900, 15, 5)), ["too_dark"]);
  assert.deepEqual(await issues(photo(1200, 900, 245, 5)), ["too_bright"]);
  assert.deepEqual(await issues(photo(1200, 900, 128, 0)), ["possibly_blurry"]);
  assert.deepEqual(await issues(photo(640, 480)), ["low_resolution"]);
});

test("rejects bytes that aren't the declared image type", async () => {
  const png = await photo(1000, 800).png().toBuffer();
  await assert.rejects(prepareImage(png, "image/jpeg"), UnreadablePhotoError);
  await assert.rejects(prepareImage(Buffer.from("<html>not a photo</html>"), "image/jpeg"), UnreadablePhotoError);
  await assert.rejects(prepareImage(png, "image/gif"), UnreadablePhotoError);
});
