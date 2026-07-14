import { format } from 'date-fns';

export interface ParsedRow {
  date: string;
  description: string;
  amountCents: number;
  original: any;
  isValid: boolean;
  error?: string;
}

export function parseCsvAmount(rawAmount: any): { amountCents: number; isValid: boolean; error?: string } {
  if (!rawAmount) {
    return { amountCents: 0, isValid: false, error: 'Missing amount' };
  }
  
  // Clean string and handle common currency formats
  const cleanAmount = String(rawAmount).replace(/[$,]/g, '').trim();
  
  // Handle parentheses for negative numbers (common in bank exports)
  let processedAmount = cleanAmount;
  if (cleanAmount.startsWith('(') && cleanAmount.endsWith(')')) {
    processedAmount = `-${cleanAmount.slice(1, -1)}`;
  }

  const floatAmount = parseFloat(processedAmount);
  if (!isNaN(floatAmount)) {
    return { amountCents: Math.round(floatAmount * 100), isValid: true };
  } else {
    return { amountCents: 0, isValid: false, error: 'Invalid amount' };
  }
}

export function parseCsvDate(rawDate: any): { date: string; isValid: boolean; error?: string } {
  if (!rawDate) {
    return { date: '', isValid: false, error: 'Missing date' };
  }

  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return { date: format(d, 'yyyy-MM-dd'), isValid: true };
    } else {
      return { date: '', isValid: false, error: 'Invalid date' };
    }
  } catch (e) {
    return { date: '', isValid: false, error: 'Invalid date' };
  }
}

export function processCsvData(
  rawData: any[], 
  mapping: { dateCol: string; descCol: string; amountCol: string }
): ParsedRow[] {
  return rawData.map(row => {
    const { amountCents, isValid: isAmountValid, error: amountError } = parseCsvAmount(row[mapping.amountCol]);
    const { date, isValid: isDateValid, error: dateError } = parseCsvDate(row[mapping.dateCol]);
    const rawDesc = row[mapping.descCol] || '';
    
    const isValid = isAmountValid && isDateValid && !!rawDesc;
    const error = amountError || dateError || (!rawDesc ? 'Missing description' : undefined);

    return {
      date,
      description: String(rawDesc).substring(0, 200),
      amountCents,
      original: row,
      isValid,
      error
    };
  });
}
