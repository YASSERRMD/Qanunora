import { Injectable } from '@nestjs/common';

// NOTE: In production, replace this with puppeteer or pdfkit.
// Example:
//   import PDFDocument from 'pdfkit';
//   const doc = new PDFDocument();
//   doc.text(content);
// This implementation generates a UTF-8 text report as a Buffer (PDF-ready JSON structure).

export interface ReportFile {
  buffer: Buffer;
  filename: string;
  mimeType: 'text/plain';
}

@Injectable()
export class PdfGeneratorService {
  generateTextReport(reportData: Record<string, unknown>, reportType: string): ReportFile {
    const lines: string[] = [];
    const divider = '='.repeat(72);
    const subDivider = '-'.repeat(72);

    lines.push(divider);
    lines.push(`QANUNORA — ${reportType.toUpperCase()} REPORT`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(divider);
    lines.push('');

    this.renderSection(lines, reportData, subDivider);

    const content = lines.join('\n');
    const buffer = Buffer.from(content, 'utf-8');
    const filename = `${reportType.toLowerCase()}-report-${Date.now()}.txt`;

    return { buffer, filename, mimeType: 'text/plain' };
  }

  private renderSection(
    lines: string[],
    data: unknown,
    subDivider: string,
    depth = 0,
  ): void {
    const indent = '  '.repeat(depth);

    if (Array.isArray(data)) {
      if (data.length === 0) {
        lines.push(`${indent}(none)`);
        return;
      }
      data.forEach((item, index) => {
        lines.push(`${indent}[${index + 1}]`);
        this.renderSection(lines, item, subDivider, depth + 1);
      });
      return;
    }

    if (data !== null && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'reportType' || key === 'generatedAt') continue;
        const label = key.replace(/([A-Z])/g, ' $1').toUpperCase();

        if (Array.isArray(value)) {
          lines.push('');
          lines.push(`${indent}${subDivider}`);
          lines.push(`${indent}${label} (${value.length} items)`);
          lines.push(`${indent}${subDivider}`);
          this.renderSection(lines, value, subDivider, depth + 1);
        } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
          lines.push(`${indent}${label}:`);
          this.renderSection(lines, value, subDivider, depth + 1);
        } else {
          const displayValue =
            value instanceof Date ? value.toISOString() : String(value ?? '—');
          lines.push(`${indent}${label}: ${displayValue}`);
        }
      }
      return;
    }

    lines.push(`${indent}${String(data ?? '—')}`);
  }
}
