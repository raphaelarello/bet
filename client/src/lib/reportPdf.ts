export interface WeeklyReportLine {
  title: string;
  value: string;
}

export interface WeeklyReportSection {
  heading: string;
  lines: WeeklyReportLine[];
}

export interface WeeklyPdfReport {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  sections: WeeklyReportSection[];
  footer?: string;
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(report: WeeklyPdfReport): string {
  const lines: string[] = [];
  lines.push(report.title);
  if (report.subtitle) lines.push(report.subtitle);
  if (report.generatedAt) lines.push(`Gerado em: ${report.generatedAt}`);
  lines.push('');

  for (const section of report.sections) {
    lines.push(section.heading.toUpperCase());
    section.lines.forEach((line) => lines.push(`${line.title}: ${line.value}`));
    lines.push('');
  }

  if (report.footer) lines.push(report.footer);

  const content: string[] = ['BT', '/F1 12 Tf', '44 790 Td'];
  let isFirst = true;
  for (const line of lines.slice(0, 44)) {
    const size = line === report.title ? 17 : /^[A-ZÁÉÍÓÚÃÕÇ ]+$/.test(line) && line.length > 0 ? 12 : 10;
    if (!isFirst) content.push('0 -18 Td');
    content.push(`/F1 ${size} Tf`);
    content.push(`(${escapePdfText(line)}) Tj`);
    isFirst = false;
  }
  content.push('ET');

  const stream = content.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function downloadWeeklyPdf(report: WeeklyPdfReport, filename = 'relatorio-semanal.pdf') {
  const pdf = buildPdf(report);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
