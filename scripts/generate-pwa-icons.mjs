import sharp from "sharp";

const source = "public/brand/atos-icon-purple.png";

async function createIcon(size, output, background) {
  const padding = Math.round(size * 0.1);
  const foreground = await sharp(source)
    .extract({ left: 14, top: 0, width: 424, height: 487 })
    .flatten({ background: "#ffffff" })
    .resize(size - padding * 2, size - padding * 2, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: foreground, gravity: "center" }])
    .png()
    .toFile(output);
}

await Promise.all([
  createIcon(192, "public/icons/icon-192.png", { r: 255, g: 255, b: 255, alpha: 0 }),
  createIcon(512, "public/icons/icon-512.png", { r: 255, g: 255, b: 255, alpha: 0 }),
  createIcon(180, "public/icons/apple-touch-icon.png", { r: 255, g: 255, b: 255, alpha: 1 }),
  createIcon(512, "public/icons/icon-maskable-512.png", { r: 76, g: 29, b: 149, alpha: 1 }),
]);
