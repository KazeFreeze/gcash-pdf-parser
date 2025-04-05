// src/parsers/GCashPDFParser.ts
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

interface HeaderEntry {
  entryNo: number;
  dateTime: string;
  description: string;
  referenceNo: string;
}

interface NumericEntry {
  entryNo: number;
  debit: string;
  credit: string;
  balance: string;
}

export class GCashPDFParser {
  private pdfData: ArrayBuffer;
  private password: string;
  private transactions: Transaction[] = [];
  private pageTexts: string[] = [];
  private outputDir: string;
  // Column positions (used for both header and numeric columns)
  private columnPositions: ColumnInfo[] = [];
  // Store numeric parts (Debit, Credit, Balance) from each valid transaction line
  private numericEntries: NumericEntry[] = [];

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
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
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
      this.pageTexts = [];
      this.numericEntries = [];

      // Process each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Enrich items with position data
        const items: TextItem[] = content.items.map((item: any) => {
          const transform = item.transform;
          return {
            str: item.str,
            dir: item.dir,
            transform: transform,
            width: item.width,
            height: item.height,
            fontName: item.fontName,
            x: transform[4],
            y: transform[5],
          };
        });

        // Save raw items for debugging
        this.saveRawItems(i, items);

        // Identify column positions on the first page
        if (i === 1) {
          this.identifyColumnPositions(items);
          this.computeColumnBoundaries();
        }

        // Save a concatenated version of the page text for header extraction later
        const pageText = items.map((item) => item.str).join(" ");
        this.pageTexts.push(pageText);
        this.savePageText(i, pageText);

        // Process numeric data (Debit, Credit, Balance) using the second code’s approach
        this.extractNumericEntriesFromLineItems(items);
      }

      // Save all page texts to a debug file
      this.saveAllPageTexts();

      // Extract header entries from combined page texts (for Date/Time, Description, Reference No)
      const headerEntries = this.extractHeaderEntriesFromPageTexts();

      // Merge header entries and numeric entries by matching entry numbers (by order)
      const mergedTransactions: Transaction[] = [];
      const entryCount = Math.min(
        headerEntries.length,
        this.numericEntries.length
      );
      for (let i = 0; i < entryCount; i++) {
        mergedTransactions.push({
          dateTime: headerEntries[i].dateTime,
          description: headerEntries[i].description,
          referenceNo: headerEntries[i].referenceNo,
          debit: this.numericEntries[i].debit,
          credit: this.numericEntries[i].credit,
          balance: this.numericEntries[i].balance,
        });
      }
      if (headerEntries.length !== this.numericEntries.length) {
        console.warn(
          "Warning: The number of header entries does not match the number of numeric entries."
        );
      }
      this.transactions = mergedTransactions;
      return this.transactions;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error}`);
    }
  }

  private identifyColumnPositions(items: TextItem[]): void {
    // Look for header row by matching common column names
    const headerRowIndex = items.findIndex(
      (item) =>
        item.str.includes("Date and Time") ||
        item.str.includes("Reference No") ||
        item.str.includes("Debit") ||
        item.str.includes("Credit") ||
        item.str.includes("Balance")
    );

    if (headerRowIndex !== -1) {
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
      this.columnPositions = headerItems.map((item) => ({
        name: item.str.trim(),
        x: item.x!,
        width: item.width || 0,
      }));
    } else {
      console.warn(
        "Could not identify column header row. Using default positions."
      );
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

  // Compute boundaries (minX and maxX) based on header positions
  private computeColumnBoundaries(): void {
    this.columnPositions.sort((a, b) => a.x - b.x);
    const boundaries: number[] = [];
    for (let i = 0; i < this.columnPositions.length - 1; i++) {
      const current = this.columnPositions[i];
      const next = this.columnPositions[i + 1];
      const boundary = current.x + (next.x - current.x) / 2;
      boundaries.push(boundary);
    }
    this.columnPositions.forEach((col, idx) => {
      const minX = idx === 0 ? 0 : boundaries[idx - 1];
      const maxX =
        idx === this.columnPositions.length - 1
          ? Number.POSITIVE_INFINITY
          : boundaries[idx];
      col.minX = minX;
      col.maxX = maxX;
    });
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

  /**
   * This method groups text items into lines and uses the second code’s splitting logic
   * to extract the numeric columns (Debit, Credit, Balance). It does not extract the header
   * columns here because those are extracted later via regex from the combined page texts.
   */
  private extractNumericEntriesFromLineItems(items: TextItem[]): void {
    // Sort items by y-coordinate descending (top of the page first)
    const sortedItems = items.sort((a, b) => b.y! - a.y!);

    // Cluster items into rows using a vertical tolerance
    const tolerance = 5; // adjust as needed based on typical row height variance
    const clusters: TextItem[][] = [];

    sortedItems.forEach((item) => {
      // Try to add the item to an existing cluster if its y is close enough.
      let added = false;
      for (const cluster of clusters) {
        // Compare to the first item in the cluster
        if (Math.abs(item.y! - cluster[0].y!) <= tolerance) {
          cluster.push(item);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push([item]);
      }
    });

    // Sort each cluster's items by x coordinate (left to right)
    clusters.forEach((cluster) => {
      cluster.sort((a, b) => a.x! - b.x!);
    });

    // Process each cluster (row) for numeric data
    let numericEntryCount = this.numericEntries.length;
    for (const line of clusters) {
      const lineText = line.map((item) => item.str).join(" ");
      // Skip lines that look like headers or summaries
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

      // Use a simple date/time pattern to check if this line is a transaction line
      const dateTimePattern = /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/;
      if (!dateTimePattern.test(lineText)) {
        continue;
      }

      // Use the Debit column boundary as the splitting point (computed earlier)
      const debitColumn = this.columnPositions.find(
        (col) => col.name === "Debit"
      );
      const debitX = debitColumn?.minX || 500;
      const frontItems: TextItem[] = [];
      const backItems: TextItem[] = [];

      line.forEach((item) => {
        if (item.x! < debitX) {
          frontItems.push(item);
        } else {
          backItems.push(item);
        }
      });

      // Process the back items into numeric columns using boundaries from computeColumnBoundaries()
      const colValues: Record<string, string[]> = {
        Debit: [],
        Credit: [],
        Balance: [],
      };

      backItems.forEach((item) => {
        const xPos = item.x!;
        const relevantColumns = this.columnPositions.filter((col) =>
          ["Debit", "Credit", "Balance"].includes(col.name)
        );
        const col = relevantColumns.find(
          (col) => xPos >= (col.minX as number) && xPos < (col.maxX as number)
        );
        if (col && colValues[col.name]) {
          colValues[col.name].push(item.str);
        }
      });

      const debitStr = (colValues["Debit"] || []).join(" ").trim();
      const creditStr = (colValues["Credit"] || []).join(" ").trim();
      const balanceStr = (colValues["Balance"] || []).join(" ").trim();

      // Only add the numeric entry if at least one numeric field has data.
      if (debitStr || creditStr || balanceStr) {
        numericEntryCount++;
        this.numericEntries.push({
          entryNo: numericEntryCount,
          debit: debitStr,
          credit: creditStr,
          balance: balanceStr,
        });
      }
    }
  }

  /**
   * Extract header entries from the complete page texts.
   * This method uses a regex pattern to match rows with:
   *   (yyyy-mm-dd hh:mm AM)   (description)   (13-digit reference no)
   * It returns an array of HeaderEntry objects.
   */
  private extractHeaderEntriesFromPageTexts(): HeaderEntry[] {
    const combinedText = this.pageTexts.join("\n");
    const headerEntries: HeaderEntry[] = [];
    // Regex pattern with exactly three spaces between fields:
    //   (\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M)\s{3}(.+?)\s{3}(\d{13})
    const pattern =
      /(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M)\s{3}(.+?)\s{3}(\d{13})/g;
    let match;
    let entryNo = 0;
    while ((match = pattern.exec(combinedText)) !== null) {
      entryNo++;
      headerEntries.push({
        entryNo,
        dateTime: match[1].trim(),
        description: match[2].trim(),
        referenceNo: match[3].trim(),
      });
    }
    console.log(
      `Extracted ${headerEntries.length} header entries from page texts.`
    );
    return headerEntries;
  }

  toCSV(): string {
    if (this.transactions.length === 0) {
      return "No transactions found";
    }
    let csv = "Date and Time,Description,Reference No,Debit,Credit,Balance\n";
    this.transactions.forEach((transaction) => {
      csv += `"${transaction.dateTime}","${transaction.description}","${transaction.referenceNo}","${transaction.debit}","${transaction.credit}","${transaction.balance}"\n`;
    });
    return csv.trim();
  }

  saveCSV(filename: string = "transactions.csv"): string {
    const csvContent = this.toCSV();
    const csvDir = path.join(this.outputDir, "csv");
    const filePath = path.join(csvDir, filename);
    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  getPageTexts(): string[] {
    return this.pageTexts;
  }
}
