import { GCashPDFParser } from "./parsers/GCashPDFParser";

export async function parseGCashPDF(
  pdfData: ArrayBuffer,
  password: string,
  outputDir: string = "output"
): Promise<string> {
  const parser = new GCashPDFParser(pdfData, password, outputDir);
  await parser.parse();
  return parser.toCSV();
}
