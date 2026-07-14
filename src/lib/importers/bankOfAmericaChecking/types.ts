export interface AccountStatementSummary {
  beginningBalanceCents?: number;
  beginningBalanceDate?: string;
  totalCreditsCents?: number;
  totalDebitsCents?: number;
  endingBalanceCents?: number;
  endingBalanceDate?: string;
}

export interface ImporterDetection {
  id: string;
  confidence: number;
  headerRowIndex: number;
  summaryRows: number[];
  delimiter: string;
  dateFormat: string;
  amountConvention: 'signed';
  warnings: string[];
}
