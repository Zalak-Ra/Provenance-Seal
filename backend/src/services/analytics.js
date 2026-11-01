export const SCAN_DISCLAIMER =
  "Repeated scans, multiple clients, or differing client-reported regions can suggest a copied QR code. They do not prove that a physical product is counterfeit.";

/**
 * Classify stored scans for one product.
 * Region values are client-reported and untrusted. They are a weak signal only.
 */
export function assessScans(scans, now, options) {
  const recent = scans.filter((scan) => now - scan.timestamp <= options.scanWindowMs);
  const day = scans.filter((scan) => now - scan.timestamp <= options.scanDayMs);
  const distinctClients = new Set(recent.map((scan) => scan.clientHash).filter(Boolean)).size;
  const regions = new Set(day.map((scan) => scan.region).filter(Boolean));
  const reasons = [];

  if (recent.length >= options.suspiciousRecentScans) {
    reasons.push("This product identifier was scanned repeatedly in a short period.");
  }
  if (distinctClients >= options.suspiciousDistinctClients) {
    reasons.push("Several different clients scanned this product identifier in a short period.");
  }
  if (regions.size >= 2) {
    reasons.push("Client-reported regions differ within 24 hours. This signal can be spoofed.");
  }

  let level = "none";
  if (reasons.length === 1) level = "watch";
  if (reasons.length >= 2 || recent.length >= options.suspiciousRecentScans + 2) level = "suspicious";

  return {
    level,
    reasons,
    recentCount: recent.length,
    dayCount: day.length,
    distinctRecentClients: distinctClients,
    distinctReportedRegions: regions.size,
    disclaimer: SCAN_DISCLAIMER
  };
}
