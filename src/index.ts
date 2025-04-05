import { GCashPDFParser } from "./parsers/GCashPDFParser";
import { GCashPDFParserOptions } from "./models/Options";
import { Transaction } from "./models/Transaction";

// Export the types for TypeScript users
export { GCashPDFParser, GCashPDFParserOptions };
export type { Transaction };

/**
 * Parses a GCash Transaction History statement in PDF and extracts transaction data
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param options - Configuration options (optional)
 * @returns Promise resolving to parsed transactions
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
 * Parses a GCash Transaction History statement in PDF and returns the data as CSV
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param options - Configuration options (optional)
 * @returns Promise resolving to a CSV string containing all extracted transactions
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

/**
 * Parses a GCash Transaction History statement in PDF and saves the results to CSV
 *
 * @param pdfData - The PDF file data as an ArrayBuffer
 * @param password - The password to decrypt the PDF
 * @param outputPath - Path to save the CSV file (optional)
 * @param options - Configuration options (optional)
 * @returns Promise resolving to the path of the saved CSV file
 */
export async function parseGCashPDFtoFile(
  pdfData: ArrayBuffer,
  password: string,
  filename?: string,
  options?: GCashPDFParserOptions
): Promise<string> {
  const parser = new GCashPDFParser(pdfData, password, options);
  await parser.parse();
  return parser.saveCSV(filename);
}
