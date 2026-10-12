import QRCode from "qrcode";

/**
 * Renders a real, scannable QR code as an SVG string.
 *
 * Used for the Product Passport / unit page "Verify this product" QR. The
 * payload is always the public verification URL (site origin + /verify/serial)
 * — public data only: no auth ids, no owner details, no wallets.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#ffffff" },
  });
}
