import * as fs from "fs";
import * as path from "path";
import { GCashPDFParser } from "./parsers/GCashPDFParser";

/**
 * Command-line interface for the GCash PDF parser
 *
 * Usage: node dist/cli.js <pdfFilePath> <password> [outputDir]
 *
 * @example
 * ```
 * node dist/cli.js statement.pdf mypassword123 ./output
 * ```
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: node dist/cli.js <pdfFilePath> <password> [outputDir]"
    );
    process.exit(1);
  }

  const [pdfFilePath, password] = args;
  const outputDir = args[2] || "output";

  try {
    // Read the PDF file as an ArrayBuffer
    const fileBuffer = fs.readFileSync(pdfFilePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    ) as ArrayBuffer;

    console.log("Processing PDF file:", pdfFilePath);
    console.log("Output directory:", outputDir);

    // Parse the PDF
    const parser = new GCashPDFParser(arrayBuffer, password, outputDir);
    await parser.parse();

    // Save and output results
    const csvPath = parser.saveCSV();
    console.log(`CSV file has been generated: ${csvPath}`);

    const pageTexts = parser.getPageTexts();
    console.log(`Extracted ${pageTexts.length} pages of text`);
    console.log(
      `Check the ${path.join(
        outputDir,
        "debug"
      )} directory for extracted raw text`
    );

    // Print a sample of the first page text
    if (pageTexts.length > 0) {
      console.log("\nSample of first page text (first 200 characters):");
      console.log(pageTexts[0].substring(0, 200) + "...");
    }
  } catch (error) {
    console.error("Error processing PDF:", error);
    process.exit(1);
  }
}

main();
