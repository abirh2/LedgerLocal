import { ParsedRow } from '../../importUtils';
import { format, parse } from 'date-fns';

export function normalize(rawData: any[], headerIndex: number): ParsedRow[] {
  return rawData.slice(headerIndex + 1).map(row => {
    const rawDate = row['Date'];
    const rawDesc = row['Description'] || '';
    const rawAmount = row['Amount'];
    const rawRunningBal = row['Running Bal.'];

    // Date parsing: MM/DD/YYYY
    let postedDate = '';
    let isDateValid = false;
    try {
      const parsedDate = parse(rawDate, 'MM/dd/yyyy', new Date());
      postedDate = format(parsedDate, 'yyyy-MM-dd');
      isDateValid = true;
    } catch {
      isDateValid = false;
    }

    // Money parsing
    const cleanAmount = String(rawAmount || '').replace(/[$,"]/g, '');
    let amountCents = 0;
    let isAmountValid = false;
    
    if (cleanAmount === '') {
      // Opening balance marker, amount is blank, running bal is present
      amountCents = 0;
      isAmountValid = true; 
    } else {
      const floatAmount = parseFloat(cleanAmount);
      if (!isNaN(floatAmount)) {
        amountCents = Math.round(floatAmount * 100);
        isAmountValid = true;
      }
    }

    const isValid = isDateValid && isAmountValid;
    
    return {
      date: postedDate,
      description: rawDesc,
      amountCents: amountCents,
      original: row,
      isValid: isValid,
      error: isValid ? undefined : 'Invalid row format'
    };
  });
}
