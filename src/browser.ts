import { GCashPDFParser } from "./parsers/GCashPDFParser";
import { GCashPDFParserOptions } from "./models/Options";
import { Transaction } from "./models/Transaction";

// Export the types for TypeScript users
export { GCashPDFParser, GCashPDFParserOptions };
export type { Transaction };

/**
 * Parse a GCash PDF and extract transactions
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param options - Optional configuration
 * @returns A Promise resolving to an array of transactions
 */
export async function parseGCashPDF(
  pdfData: ArrayBuffer,
  password: string,
  options?: GCashPDFParserOptions
): Promise<Transaction[]> {
  const parser = new GCashPDFParser(pdfData, password, options);
  await parser.parse();
  return parser.getTransactions();
}

/**
 * Parse a GCash PDF and convert to CSV string
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param options - Optional configuration
 * @returns A Promise resolving to a CSV string
 */
export async function parseGCashPDFtoCSV(
  pdfData: ArrayBuffer,
  password: string,
  options?: GCashPDFParserOptions
): Promise<string> {
  const parser = new GCashPDFParser(pdfData, password, options);
  await parser.parse();
  return parser.toCSV();
}

// Create a default export for easier browser usage
export default {
  GCashPDFParser,
  parseGCashPDF,
  parseGCashPDFtoCSV,
};
