# GCash PDF Parser

A TypeScript library for extracting transaction data from GCash PDF statements.

## Installation

```bash
npm install gcash-pdf-parser
```

Or directly from GitHub:

```bash
npm install github:KazeFreeze/gcash-pdf-parser
```

## Features

- Extract transaction data from password-protected GCash PDF statements
- Convert transaction data to CSV format
- Save transaction data to CSV files
- Optional debug mode for troubleshooting

## Usage

### Basic Usage

```typescript
import { parseGCashPDF } from "gcash-pdf-parser";
import * as fs from "fs";

async function example() {
  // Read PDF file
  const fileBuffer = fs.readFileSync("statement.pdf");
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;

  // Parse PDF
  const transactions = await parseGCashPDF(arrayBuffer, "password123");
  console.log(`Extracted ${transactions.length} transactions`);
  console.log(transactions[0]);
}

example();
```

### Getting CSV Output

```typescript
import { parseGCashPDFtoCSV } from "gcash-pdf-parser";
import * as fs from "fs";

async function example() {
  const fileBuffer = fs.readFileSync("statement.pdf");
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;

  // Get CSV string
  const csv = await parseGCashPDFtoCSV(arrayBuffer, "password123");
  console.log(csv);
}

example();
```

### Saving to CSV File

```typescript
import { parseGCashPDFtoFile } from "gcash-pdf-parser";
import * as fs from "fs";

async function example() {
  const fileBuffer = fs.readFileSync("statement.pdf");
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;

  // Save to CSV file
  const csvPath = await parseGCashPDFtoFile(
    arrayBuffer,
    "password123",
    "my_transactions.csv",
    { outputDir: "./output" }
  );

  console.log(`CSV saved to: ${csvPath}`);
}

example();
```

### Using Debug Mode

```typescript
import { GCashPDFParser } from "gcash-pdf-parser";
import * as fs from "fs";

async function example() {
  const fileBuffer = fs.readFileSync("statement.pdf");
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;

  // Enable debug mode
  const parser = new GCashPDFParser(arrayBuffer, "password123", {
    outputDir: "./output",
    debug: true,
  });

  await parser.parse();
  const csvPath = parser.saveCSV();

  console.log(`CSV saved to: ${csvPath}`);
  console.log(`Debug files saved to: ./output/debug/`);
}

example();
```

## API Reference

### Functions

#### `parseGCashPDF(pdfData: ArrayBuffer, password: string, options?: GCashPDFParserOptions): Promise<Transaction[]>`

Parses a GCash PDF and returns an array of transactions.

#### `parseGCashPDFtoCSV(pdfData: ArrayBuffer, password: string, options?: GCashPDFParserOptions): Promise<string>`

Parses a GCash PDF and returns the transactions as a CSV string.

#### `parseGCashPDFtoFile(pdfData: ArrayBuffer, password: string, filename?: string, options?: GCashPDFParserOptions): Promise<string>`

Parses a GCash PDF and saves the transactions to a CSV file.

### Classes

#### `GCashPDFParser`

The main parser class that handles PDF extraction.

```typescript
constructor(
  pdfData: ArrayBuffer,
  password: string,
  options?: GCashPDFParserOptions
)
```

##### Methods

- `parse(): Promise<Transaction[]>` - Parses the PDF and returns transactions
- `toCSV(): string` - Converts parsed transactions to CSV format
- `saveCSV(filename?: string): string` - Saves transactions to a CSV file
- `getTransactions(): Transaction[]` - Returns parsed transactions
- `getPageTexts(): string[]` - Returns extracted text from PDF pages

### Interfaces

#### `Transaction`

```typescript
interface Transaction {
  dateTime: string;
  description: string;
  referenceNo: string;
  debit: string;
  credit: string;
  balance: string;
}
```

#### `GCashPDFParserOptions`

```typescript
interface GCashPDFParserOptions {
  outputDir?: string; // Directory to save output files (default: "output")
  debug?: boolean; // Enable debug output (default: false)
}
```

## License

MIT
