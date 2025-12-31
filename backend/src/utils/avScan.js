// Placeholder for antivirus scanning hook. Disabled by default.
// Extend this function to integrate with a scanning service (e.g., ClamAV, VirusTotal).
export async function scanFileForThreats(filePath) {
  if (process.env.ENABLE_AV_SCAN === 'true') {
    // Implement actual scanning here and throw if malicious.
    throw new Error('Antivirus scanning is not yet implemented.');
  }

  return { scanned: false, filePath };
}

// Mutable wrapper to allow stable mocking in node:test
export const security = {
  scanFileForThreats
};

