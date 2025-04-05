import { GCashPDFParser } from "./parsers/GCashPDFParser";

/**
 * Parses a GCash Transaction History statement in PDF and extracts transaction data into CSV format
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param outputDir - Directory to save output files (default: "output")
 * @returns Promise resolving to a CSV string containing all extracted transactions
 */
export async function parseGCashPDF(
  pdfData: ArrayBuffer,
  password: string,
  outputDir: string = "output"
): Promise<string> {
  const parser = new GCashPDFParser(pdfData, password, outputDir);
  await parser.parse();
  return parser.toCSV();
}
