import { Injectable } from '@nestjs/common';

// NOTE: In production, replace this with exceljs or xlsx to generate real .xlsx files.
// This implementation generates a CSV-formatted report as a Buffer.

export interface CsvFile {
  buffer: Buffer;
  filename: string;
  mimeType: 'text/csv';
}

@Injectable()
export class ExcelGeneratorService {
  generateCsv(reportData: Record<string, unknown>, reportType: string): CsvFile {
    const rows: string[][] = [];

    // Header metadata rows
    rows.push(['Report Type', reportType]);
    rows.push(['Generated At', new Date().toISOString()]);
    rows.push([]);

    this.flattenToCsvRows(reportData, rows, '');

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '');
            // Escape double-quotes and wrap cells containing commas/newlines/quotes
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(','),
      )
      .join('\n');

    const buffer = Buffer.from(csvContent, 'utf-8');
    const filename = `${reportType.toLowerCase()}-report-${Date.now()}.csv`;

    return { buffer, filename, mimeType: 'text/csv' };
  }

  private flattenToCsvRows(
    data: unknown,
    rows: string[][],
    prefix: string,
  ): void {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        rows.push([prefix, '(none)']);
        return;
      }

      // For arrays of objects: emit a header row then data rows
      const firstItem = data[0];
      if (firstItem !== null && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        const keys = Object.keys(firstItem as object);
        rows.push(keys.map((k) => `${prefix ? prefix + '.' : ''}${k}`));
        for (const item of data) {
          const obj = item as Record<string, unknown>;
          rows.push(
            keys.map((k) => {
              const v = obj[k];
              if (v instanceof Date) return v.toISOString();
              if (v !== null && typeof v === 'object') return JSON.stringify(v);
              return String(v ?? '');
            }),
          );
        }
      } else {
        // Primitive array
        rows.push([prefix, ...data.map((v) => String(v ?? ''))]);
      }
      return;
    }

    if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
      const obj = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'reportType' || key === 'generatedAt') continue;
        const childPrefix = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(value)) {
          rows.push([]);
          rows.push([`--- ${childPrefix.toUpperCase()} ---`]);
          this.flattenToCsvRows(value, rows, childPrefix);
        } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
          this.flattenToCsvRows(value, rows, childPrefix);
        } else {
          const displayValue = value instanceof Date ? value.toISOString() : String(value ?? '');
          rows.push([childPrefix, displayValue]);
        }
      }
      return;
    }

    rows.push([prefix, String(data ?? '')]);
  }
}
