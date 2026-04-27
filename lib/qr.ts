import qrcodegen from "./vendor/qrcodegen.ts";

interface QrSvgOptions {
  moduleMargin?: number;
  darkColor?: string;
  lightColor?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function generateQrSvg(
  text: string,
  options: QrSvgOptions = {},
): string {
  const margin = Math.max(0, Math.floor(options.moduleMargin ?? 1));
  const darkColor = options.darkColor ?? "#111111";
  const lightColor = options.lightColor ?? "#ffffff";

  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const size = qr.size;
  const viewSize = size + margin * 2;

  // Build one path from all dark modules for compact SVG output.
  const segments: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.getModule(x, y)) {
        const xx = x + margin;
        const yy = y + margin;
        segments.push(`M${xx},${yy}h1v1h-1z`);
      }
    }
  }

  const pathData = segments.join("");
  const title = escapeXml(`QR code for ${text}`);

  return [
    `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${viewSize} ${viewSize}\" shape-rendering=\"crispEdges\">`,
    `<title>${title}</title>`,
    `<rect width=\"100%\" height=\"100%\" fill=\"${escapeXml(lightColor)}\"/>`,
    `<path d=\"${pathData}\" fill=\"${escapeXml(darkColor)}\"/>`,
    `</svg>`,
  ].join("");
}

export function generateQrDataUri(
  text: string,
  options?: QrSvgOptions,
): string {
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
