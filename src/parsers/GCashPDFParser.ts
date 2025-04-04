import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as fs from "fs";
import * as path from "path";
import { Transaction } from "../models/Transaction";

interface TextItem {
  str: string;
  dir?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  // Position properties
  x?: number;
  y?: number;
}

interface ColumnInfo {
  name: string;
  x: number;
  width: number;
  minX?: number;
  maxX?: number;
}

export class GCashPDFParser {
  private pdfData: ArrayBuffer;
  private password: string;
  private transactions: Transaction[] = [];
  private pageTexts: string[] = [];
  private outputDir: string;
  private columnPositions: ColumnInfo[] = [];

  constructor(
    pdfData: ArrayBuffer,
    password: string,
    outputDir: string = "output"
  ) {
    this.pdfData = pdfData;
    this.password = password;
    this.outputDir = outputDir;
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Create subdirectories for different formats
    const formats = ["csv", "txt", "debug"];
    formats.forEach((format) => {
      const formatDir = path.join(this.outputDir, format);
      if (!fs.existsSync(formatDir)) {
        fs.mkdirSync(formatDir, { recursive: true });
      }
    });
  }

  async parse(): Promise<Transaction[]> {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: this.pdfData,
        password: this.password,
      });

      const pdf = await loadingTask.promise;
      this.transactions = [];
      this.pageTexts = []; // Reset page texts

      // Process each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Add position information to text items
        const items: TextItem[] = content.items.map((item: any) => {
          const transform = item.transform;
          return {
            str: item.str,
            dir: item.dir,
            transform: item.transform,
            width: item.width,
            height: item.height,
            fontName: item.fontName,
            x: transform[4], // x-coordinate
            y: transform[5], // y-coordinate
          };
        });

        // Save raw items to debug file for inspection
        this.saveRawItems(i, items);

        // Look for header row to identify column positions (only on first page)
        if (i === 1) {
          this.identifyColumnPositions(items);
          // Compute explicit boundaries for each column based on header positions.
          this.computeColumnBoundaries();
        }

        // Create page text for debugging
        const pageText = items.map((item) => item.str).join(" ");
        this.pageTexts.push(pageText);
        this.savePageText(i, pageText);

        // Extract transactions using positional information
        this.extractTransactionsFromItems(items);
      }

      // Save all extracted page texts to a single file
      this.saveAllPageTexts();

      return this.transactions;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error}`);
    }
  }

  private identifyColumnPositions(items: TextItem[]): void {
    // Look for header row with column names
    const headerRowIndex = items.findIndex(
      (item) =>
        item.str.includes("Date and Time") ||
        item.str.includes("Reference No") ||
        item.str.includes("Debit") ||
        item.str.includes("Credit") ||
        item.str.includes("Balance")
    );

    if (headerRowIndex !== -1) {
      // Find items that are likely to be header columns.
      // Assume header items are on the same y-coordinate (or very close).
      const headerItems = items.filter((item) => {
        return (
          Math.abs(item.y! - items[headerRowIndex].y!) < 2 &&
          [
            "Date and Time",
            "Description",
            "Reference No",
            "Debit",
            "Credit",
            "Balance",
          ].some((header) => item.str.includes(header))
        );
      });

      console.log(
        "Identified header items:",
        headerItems.map((i) => ({ str: i.str, x: i.x }))
      );

      // Create column info based on header positions.
      // If the first three headers are merged (e.g. "Date and Time   Description   Reference No"),
      // they will be detected as one column which we later split.
      this.columnPositions = headerItems.map((item) => ({
        name: item.str.trim(),
        x: item.x!,
        width: item.width!,
      }));
    } else {
      console.warn(
        "Could not identify column header row. Using default positions."
      );
      // Define fallback column positions based on your knowledge of the PDF
      this.columnPositions = [
        { name: "Date and Time", x: 0, width: 150 },
        { name: "Description", x: 150, width: 250 },
        { name: "Reference No", x: 400, width: 100 },
        { name: "Debit", x: 500, width: 80 },
        { name: "Credit", x: 580, width: 80 },
        { name: "Balance", x: 660, width: 80 },
      ];
    }
  }

  // Compute boundaries for each column based on header positions.
  // This creates minX and maxX values for each column.
  private computeColumnBoundaries(): void {
    // Sort columns by x (left to right)
    this.columnPositions.sort((a, b) => a.x - b.x);

    // Compute boundary midpoints between adjacent columns.
    const boundaries: number[] = [];
    for (let i = 0; i < this.columnPositions.length - 1; i++) {
      const current = this.columnPositions[i];
      const next = this.columnPositions[i + 1];
      const boundary = current.x + (next.x - current.x) / 2;
      boundaries.push(boundary);
    }

    // Assign minX and maxX to each column.
    this.columnPositions.forEach((col, idx) => {
      const minX = idx === 0 ? 0 : boundaries[idx - 1];
      const maxX =
        idx === this.columnPositions.length - 1
          ? Number.POSITIVE_INFINITY
          : boundaries[idx];
      col.minX = minX;
      col.maxX = maxX;
    });

    // Save column positions with boundaries for debugging
    fs.writeFileSync(
      path.join(this.outputDir, "debug", "column_positions.json"),
      JSON.stringify(this.columnPositions, null, 2)
    );
  }

  private saveRawItems(pageNum: number, items: TextItem[]): void {
    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, `page_${pageNum}_raw_items.json`);
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
  }

  private savePageText(pageNum: number, text: string): void {
    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, `page_${pageNum}.txt`);
    fs.writeFileSync(filePath, text);
  }

  private saveAllPageTexts(): void {
    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, "all_pages.txt");
    fs.writeFileSync(
      filePath,
      this.pageTexts.join("\n\n--- PAGE BREAK ---\n\n")
    );
  }

  private extractTransactionsFromItems(items: TextItem[]): void {
    // Group items by y-coordinate (roughly same line)
    const lineGroups = new Map<number, TextItem[]>();

    items.forEach((item) => {
      // Round y-coordinate to group items on the same line
      const roundedY = Math.round(item.y! * 10) / 10;
      if (!lineGroups.has(roundedY)) {
        lineGroups.set(roundedY, []);
      }
      lineGroups.get(roundedY)!.push(item);
    });

    // Sort line groups by y-coordinate (top to bottom)
    const sortedLines = Array.from(lineGroups.entries())
      .sort((a, b) => b[0] - a[0]) // higher y is higher on page
      .map((entry) => entry[1]);

    // Process each line
    for (const line of sortedLines) {
      // Sort items in the line by x-coordinate
      line.sort((a, b) => a.x! - b.x!);

      const lineText = line.map((item) => item.str).join(" ");
      if (
        lineText.includes("Date and Time") ||
        lineText.includes("STARTING BALANCE") ||
        lineText.includes("ENDING BALANCE") ||
        lineText.includes("Total Debit") ||
        lineText.includes("Total Credit") ||
        !lineText.trim()
      ) {
        continue;
      }

      // Check if this looks like a transaction line (based on a date/time pattern)
      const dateTimePattern = /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/;
      if (!dateTimePattern.test(lineText)) {
        continue;
      }

      // Find the "Debit" column position
      const debitColumn = this.columnPositions.find(
        (col) => col.name === "Debit"
      );
      const debitX = debitColumn?.minX || 500; // Use 500 as fallback if not found

      // Separate items into two groups: before Debit column and from Debit column onwards
      const frontItems: TextItem[] = [];
      const backItems: TextItem[] = [];

      line.forEach((item) => {
        if (item.x! < debitX) {
          frontItems.push(item);
        } else {
          backItems.push(item);
        }
      });

      // Combine front items into one string
      const frontText = frontItems
        .map((item) => item.str)
        .join(" ")
        .trim();

      // Initialize record for the numerical columns (Debit, Credit, Balance)
      const colValues: Record<string, string[]> = {
        Debit: [],
        Credit: [],
        Balance: [],
      };

      // Process the back items using positional information
      backItems.forEach((item) => {
        const xPos = item.x!;
        // Find which column this item belongs to
        const relevantColumns = this.columnPositions.filter(
          (col) =>
            col.name === "Debit" ||
            col.name === "Credit" ||
            col.name === "Balance"
        );

        const col = relevantColumns.find(
          (col) => xPos >= (col.minX as number) && xPos < (col.maxX as number)
        );

        if (col && colValues[col.name]) {
          colValues[col.name].push(item.str);
        }
      });

      // IMPROVED PARSING LOGIC:
      // 1. Extract date and time using regex
      let dateTime = "";
      let description = "";
      let referenceNo = "";

      // Extract date and time from the beginning of the text
      const dateTimeMatch = frontText.match(
        /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/
      );
      if (dateTimeMatch) {
        dateTime = dateTimeMatch[0];

        // 2. Extract the reference number (13 digits) from the end
        const refNoMatch = frontText.match(/\d{13}$/);
        if (refNoMatch) {
          referenceNo = refNoMatch[0];

          // 3. Everything in between is the description
          // Calculate the start and end positions
          const dateTimeEndPos = frontText.indexOf(dateTime) + dateTime.length;
          const refNoStartPos = frontText.lastIndexOf(referenceNo);

          // Extract and trim the description
          if (refNoStartPos > dateTimeEndPos) {
            description = frontText
              .substring(dateTimeEndPos, refNoStartPos)
              .trim();
          }
        } else {
          // If no reference number found, everything after date/time is description
          description = frontText.substring(dateTime.length).trim();
        }
      }

      // Get the values for the numerical columns
      const debitStr = (colValues["Debit"] || []).join(" ").trim();
      const creditStr = (colValues["Credit"] || []).join(" ").trim();
      const balanceStr = (colValues["Balance"] || []).join(" ").trim();

      // Create a new transaction object if the date/time is found
      if (dateTime) {
        this.transactions.push({
          dateTime,
          description,
          referenceNo,
          debit: debitStr,
          credit: creditStr,
          balance: balanceStr,
        });
      }
    }
  }

  toCSV(): string {
    if (this.transactions.length === 0) {
      return "No transactions found";
    }

    // CSV header
    let csv = "Date and Time,Description,Reference No,Debit,Credit,Balance\n";

    // Add each transaction as a CSV row
    this.transactions.forEach((transaction) => {
      csv += `"${transaction.dateTime}","${transaction.description}","${transaction.referenceNo}","${transaction.debit}","${transaction.credit}","${transaction.balance}"\n`;
    });

    return csv.trim();
  }

  // Save CSV output to file
  saveCSV(filename: string = "transactions.csv"): string {
    const csvContent = this.toCSV();
    const csvDir = path.join(this.outputDir, "csv");
    const filePath = path.join(csvDir, filename);

    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  // Debug method to get raw page texts
  getPageTexts(): string[] {
    return this.pageTexts;
  }
}
