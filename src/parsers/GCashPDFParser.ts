import * as fs from "fs";
import * as path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { Transaction } from "../models/Transaction";

/**
 * Text item extracted from a PDF page
 */
interface TextItem {
  str: string;
  dir?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  x?: number;
  y?: number;
}

/**
 * Information about a column in the PDF table
 */
interface ColumnInfo {
  name: string;
  x: number;
  width: number;
  minX?: number;
  maxX?: number;
}

/**
 * Represents a header entry in a transaction
 */
interface HeaderEntry {
  entryNo: number;
  dateTime: string;
  description: string;
  referenceNo: string;
}

/**
 * Represents a numeric entry in a transaction
 */
interface NumericEntry {
  entryNo: number;
  debit: string;
  credit: string;
  balance: string;
}

/**
 * Configuration options for GCashPDFParser
 */
export interface GCashPDFParserOptions {
  /** Directory to save output files (default: "output") */
  outputDir?: string;
  /** Enable debug output (default: false) */
  debug?: boolean;
}

/**
 * Parser for GCash PDF statements that extracts transactions into a structured format
 */
export class GCashPDFParser {
  private pdfData: ArrayBuffer;
  private password: string;
  private transactions: Transaction[] = [];
  private pageTexts: string[] = [];
  private outputDir: string;
  private debug: boolean;
  private columnPositions: ColumnInfo[] = [];
  private numericEntries: NumericEntry[] = [];

  /**
   * Creates a new GCashPDFParser instance
   *
   * @param pdfData - The PDF file data as an ArrayBuffer
   * @param password - The password to decrypt the PDF
   * @param options - Configuration options
   */
  constructor(
    pdfData: ArrayBuffer,
    password: string,
    options?: GCashPDFParserOptions
  ) {
    this.pdfData = pdfData;
    this.password = password;
    this.outputDir = options?.outputDir || "output";
    this.debug = options?.debug || false;

    if (this.debug || options?.outputDir) {
      this.ensureDirectoriesExist();
    }
  }

  /**
   * Creates necessary output directories if they don't exist
   */
  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const formats = ["csv", "txt"];
    if (this.debug) {
      formats.push("debug");
    }

    formats.forEach((format) => {
      const formatDir = path.join(this.outputDir, format);
      if (!fs.existsSync(formatDir)) {
        fs.mkdirSync(formatDir, { recursive: true });
      }
    });
  }

  /**
   * Parses the PDF and extracts transaction data
   *
   * @returns Promise resolving to an array of transactions
   */
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

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

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

        if (this.debug) {
          this.saveRawItems(i, items);
        }

        if (i === 1) {
          this.identifyColumnPositions(items);
          this.computeColumnBoundaries();
        }

        const pageText = items.map((item) => item.str).join(" ");
        this.pageTexts.push(pageText);

        if (this.debug) {
          this.savePageText(i, pageText);
        }

        this.extractNumericEntriesFromLineItems(items);
      }

      if (this.debug) {
        this.saveAllPageTexts();
      }

      const headerEntries = this.extractHeaderEntriesFromPageTexts();
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

      if (headerEntries.length !== this.numericEntries.length && this.debug) {
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

  /**
   * Identifies the column positions from the table header
   *
   * @param items - Text items from the PDF page
   */
  private identifyColumnPositions(items: TextItem[]): void {
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

      if (this.debug) {
        console.log(
          "Identified header items:",
          headerItems.map((i) => ({ str: i.str, x: i.x }))
        );
      }

      this.columnPositions = headerItems.map((item) => ({
        name: item.str.trim(),
        x: item.x!,
        width: item.width || 0,
      }));
    } else {
      if (this.debug) {
        console.warn(
          "Could not identify column header row. Using default positions."
        );
      }

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

  /**
   * Computes column boundaries for accurate text extraction
   */
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

    if (this.debug) {
      fs.writeFileSync(
        path.join(this.outputDir, "debug", "column_positions.json"),
        JSON.stringify(this.columnPositions, null, 2)
      );
    }
  }

  /**
   * Saves raw PDF text items for debugging
   *
   * @param pageNum - Page number
   * @param items - Text items from the page
   */
  private saveRawItems(pageNum: number, items: TextItem[]): void {
    if (!this.debug) return;

    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, `page_${pageNum}_raw_items.json`);
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
  }

  /**
   * Saves extracted page text for debugging
   *
   * @param pageNum - Page number
   * @param text - Extracted text from the page
   */
  private savePageText(pageNum: number, text: string): void {
    if (!this.debug) return;

    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, `page_${pageNum}.txt`);
    fs.writeFileSync(filePath, text);
  }

  /**
   * Saves all extracted page texts combined
   */
  private saveAllPageTexts(): void {
    if (!this.debug) return;

    const debugDir = path.join(this.outputDir, "debug");
    const filePath = path.join(debugDir, "all_pages.txt");
    fs.writeFileSync(
      filePath,
      this.pageTexts.join("\n\n--- PAGE BREAK ---\n\n")
    );
  }

  /**
   * Extracts numeric entries (debit, credit, balance) from text items
   *
   * @param items - Text items from a PDF page
   */
  private extractNumericEntriesFromLineItems(items: TextItem[]): void {
    const sortedItems = items.sort((a, b) => b.y! - a.y!);
    const tolerance = 5;
    const clusters: TextItem[][] = [];

    sortedItems.forEach((item) => {
      let added = false;
      for (const cluster of clusters) {
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

    clusters.forEach((cluster) => {
      cluster.sort((a, b) => a.x! - b.x!);
    });

    let numericEntryCount = this.numericEntries.length;
    for (const line of clusters) {
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

      const dateTimePattern = /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/;
      if (!dateTimePattern.test(lineText)) {
        continue;
      }

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
   * Extracts header entries from page texts using regex pattern matching
   *
   * @returns Array of header entries containing date/time, description, and reference number
   */
  private extractHeaderEntriesFromPageTexts(): HeaderEntry[] {
    const combinedText = this.pageTexts.join("\n");
    const headerEntries: HeaderEntry[] = [];
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

    if (this.debug) {
      console.log(
        `Extracted ${headerEntries.length} header entries from page texts.`
      );
    }

    return headerEntries;
  }

  /**
   * Gets the extracted transactions
   *
   * @returns Array of transactions
   */
  getTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Converts transactions to CSV format
   *
   * @returns CSV string of transactions
   */
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

  /**
   * Saves transactions as a CSV file
   *
   * @param filename - Output filename (default: "transactions.csv")
   * @returns Full path to the saved CSV file
   */
  saveCSV(filename: string = "transactions.csv"): string {
    const csvContent = this.toCSV();
    const csvDir = path.join(this.outputDir, "csv");

    // Ensure the directory exists
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }

    const filePath = path.join(csvDir, filename);
    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  /**
   * Gets the extracted text from all pages
   *
   * @returns Array of page texts
   */
  getPageTexts(): string[] {
    return this.pageTexts;
  }
}
