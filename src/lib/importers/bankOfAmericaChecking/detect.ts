import { ImporterDetection } from './types';

export function detect(rawData: any[]): ImporterDetection | null {
  // Check for BofA summary structure
  const hasSummary = rawData.some(row => 
    row['Description']?.includes('Beginning balance as of') || 
    row['Description']?.includes('Total credits') ||
    row['Description']?.includes('Total debits')
  );

  // Check for transaction headers
  const transactionHeaderIndex = rawData.findIndex(row => 
    row['Date'] && row['Description'] && row['Amount'] && row['Running Bal.']
  );

  if (hasSummary && transactionHeaderIndex > -1) {
    return {
      id: 'bank-of-america-checking',
      confidence: 1.0,
      headerRowIndex: transactionHeaderIndex,
      summaryRows: rawData.filter((row, i) => i < transactionHeaderIndex).map((_, i) => i),
      delimiter: ',',
      dateFormat: 'MM/DD/YYYY',
      amountConvention: 'signed',
      warnings: []
    };
  }

  return null;
}
