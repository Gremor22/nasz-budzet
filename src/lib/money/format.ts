/** Money helpers — always integer grosze. */

export function zlToGrosze(zl: number): number {
  return Math.round(zl * 100);
}

export function groszeToZl(grosze: number): number {
  return grosze / 100;
}

/** Polish format: 1 250,50 zł */
export function formatPln(grosze: number): string {
  const sign = grosze < 0 ? "−" : "";
  const abs = Math.abs(grosze);
  const zl = Math.floor(abs / 100);
  const gr = abs % 100;
  const zlFormatted = zl.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${zlFormatted},${gr.toString().padStart(2, "0")} zł`;
}

export function formatPlnShort(grosze: number): string {
  const sign = grosze < 0 ? "−" : "";
  const abs = Math.abs(grosze);
  const zl = Math.round(abs / 100);
  const zlFormatted = zl.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${zlFormatted} zł`;
}
