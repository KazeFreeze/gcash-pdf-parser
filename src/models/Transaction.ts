/**
 * Represents a financial transaction extracted from a GCash PDF statement
 */
export interface Transaction {
  /**
   * Date and time of the transaction in the format "YYYY-MM-DD HH:MM AM/PM"
   */
  dateTime: string;

  /**
   * Description of the transaction
   */
  description: string;

  /**
   * Reference number of the transaction (typically 13 digits)
   */
  referenceNo: string;

  /**
   * Debit amount (money out) as a string
   */
  debit: string;

  /**
   * Credit amount (money in) as a string
   */
  credit: string;

  /**
   * Account balance after the transaction as a string
   */
  balance: string;
}
