# GCash PDF Parser

A Node.js library that extracts transaction data from GCash PDF statements. Works in both Node.js and browser environments.

[![npm version](https://img.shields.io/npm/v/gcash-pdf-parser.svg)](https://www.npmjs.com/package/gcash-pdf-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Extract all transactions from GCash PDF statements
- Works with password-protected PDFs
- Export to CSV format
- Supports both Node.js and browser environments
- TypeScript support
- Command-line interface for quick extraction

## Installation

```bash
npm install gcash-pdf-parser
```

## Usage

### Node.js

```javascript
const fs = require("fs");
const {
  parseGCashPDF,
  parseGCashPDFtoCSV,
  parseGCashPDFtoFile,
} = require("gcash-pdf-parser");

// Read PDF file
const pdfBuffer = fs.readFileSync("statement.pdf");
const pdfData = pdfBuffer.buffer.slice(
  pdfBuffer.byteOffset,
  pdfBuffer.byteOffset + pdfBuffer.byteLength
);

// Extract transactions (returns Transaction[] objects)
parseGCashPDF(pdfData, "your-pdf-password")
  .then((transactions) => {
    console.log(`Found ${transactions.length} transactions`);
    console.log(transactions[0]); // Sample first transaction
  })
  .catch((err) => console.error("Error parsing PDF:", err));

// Get CSV string
parseGCashPDFtoCSV(pdfData, "your-pdf-password")
  .then((csv) => {
    console.log("CSV data:", csv);
  })
  .catch((err) => console.error("Error generating CSV:", err));

// Save directly to file
parseGCashPDFtoFile(pdfData, "your-pdf-password", "output.csv")
  .then((filePath) => {
    console.log(`CSV saved to: ${filePath}`);
  })
  .catch((err) => console.error("Error saving CSV:", err));
```

### TypeScript

```typescript
import { parseGCashPDF, Transaction } from "gcash-pdf-parser";
import * as fs from "fs";

async function extractTransactions(
  filePath: string,
  password: string
): Promise<Transaction[]> {
  const pdfBuffer = fs.readFileSync(filePath);
  const pdfData = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  return await parseGCashPDF(pdfData, password);
}

extractTransactions("statement.pdf", "your-password")
  .then((transactions) =>
    console.log(`Found ${transactions.length} transactions`)
  )
  .catch((err) => console.error("Error:", err));
```

### Browser

```html
<script src="path/to/gcash-pdf-parser.min.js"></script>
<script>
  document
    .getElementById("fileInput")
    .addEventListener("change", async (event) => {
      const file = event.target.files[0];
      const password = document.getElementById("passwordInput").value;

      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      try {
        // Parse the PDF
        const transactions = await GCashPDFParser.parseGCashPDF(
          arrayBuffer,
          password
        );
        console.log(`Found ${transactions.length} transactions`);

        // Or get CSV data
        const csv = await GCashPDFParser.parseGCashPDFtoCSV(
          arrayBuffer,
          password
        );
        console.log("CSV data ready for download");
      } catch (error) {
        console.error("Error parsing PDF:", error);
      }
    });
</script>
```

Alternatively with a bundler (webpack, rollup, etc.):

```javascript
import { parseGCashPDF } from "gcash-pdf-parser";

async function handleFileUpload(file, password) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const transactions = await parseGCashPDF(arrayBuffer, password);
    return transactions;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw error;
  }
}
```

### Command Line

The package includes a command-line tool for quick extractions:

```bash
# Install globally
npm install -g gcash-pdf-parser

# Use the CLI
gcash-pdf-parser statement.pdf your-password ./output-directory
```

Or directly using node:

```bash
node node_modules/gcash-pdf-parser/dist/cli.js statement.pdf your-password ./output
```

## API Reference

### Main Functions

#### `parseGCashPDF(pdfData, password, options?)`

Parse a GCash PDF statement and extract transactions.

- **pdfData**: `ArrayBuffer` - The PDF file data
- **password**: `string` - Password to decrypt the PDF
- **options**: `GCashPDFParserOptions` (optional) - Configuration options
- **Returns**: `Promise<Transaction[]>` - Array of transaction objects

#### `parseGCashPDFtoCSV(pdfData, password, options?)`

Parse a GCash PDF statement and convert to CSV.

- **pdfData**: `ArrayBuffer` - The PDF file data
- **password**: `string` - Password to decrypt the PDF
- **options**: `GCashPDFParserOptions` (optional) - Configuration options
- **Returns**: `Promise<string>` - CSV string

#### `parseGCashPDFtoFile(pdfData, password, filename?, options?)`

Parse a GCash PDF statement and save to a CSV file (Node.js only).

- **pdfData**: `ArrayBuffer` - The PDF file data
- **password**: `string` - Password to decrypt the PDF
- **filename**: `string` (optional) - Output filename (default: "transactions.csv")
- **options**: `GCashPDFParserOptions` (optional) - Configuration options
- **Returns**: `Promise<string>` - Path to the saved file

### Classes

#### `GCashPDFParser`

Main parser class with additional methods for customization.

```typescript
const parser = new GCashPDFParser(pdfData, password, options);
await parser.parse();
const transactions = parser.getTransactions();
```

### Types

#### `Transaction`

```typescript
interface Transaction {
  dateTime: string; // Format: "YYYY-MM-DD HH:MM AM/PM"
  description: string; // Transaction description
  referenceNo: string; // 13-digit reference number
  debit: string; // Amount debited (empty if none)
  credit: string; // Amount credited (empty if none)
  balance: string; // Balance after transaction
}
```

#### `GCashPDFParserOptions`

```typescript
interface GCashPDFParserOptions {
  outputDir?: string; // Directory to save output files (default: "output")
  debug?: boolean; // Enable debug output (default: false)
}
```

## Troubleshooting

### Common Issues

1. **Failed to parse PDF**: Ensure the password is correct and the PDF is a valid GCash statement.
2. **No transactions found**: The parser may not recognize the format of your statement. Try enabling debug mode.
3. **Browser compatibility**: The library uses PDF.js for parsing, which works in modern browsers.

### Debug Mode

Enable debug mode to get more information:

```javascript
const parser = new GCashPDFParser(pdfData, password, { debug: true });
await parser.parse();
// Debug files will be saved to output/debug/
```

## License

MIT
