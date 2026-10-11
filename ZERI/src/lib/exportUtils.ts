import { Report } from '../types';

export const exportToCSV = (filename: string, headers: string[], data: string[][]) => {
  const processRow = (row: string[]) => {
    return row.map(val => {
      // Escape quotes and wrap in quotes if contains comma
      const stringVal = String(val || '').replace(/"/g, '""');
      return `"${stringVal}"`;
    }).join(',');
  };

  const csvContent = [
    processRow(headers),
    ...data.map(processRow)
  ].join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getCompetentOrgan = (category: string) => {
  if (category.startsWith('Komuna - ')) {
    return 'Komuna';
  } else if (category.startsWith('Ministria ')) {
    return 'Qeveria / Ministria';
  } else if (category.startsWith('Ujësjellësi ') || category.startsWith('KEDS ') || category.startsWith('Kompania ')) {
    return 'Ndërmarrjet Publike Regjionale';
  } else if (category.startsWith('Policia ') || category.startsWith('Inspekcioni ') || category.startsWith('Zjarrfikësit ')) {
    return 'Siguria dhe Inspekcioni';
  }
  
  // Fallbacks for older reports
  switch (category) {
    case 'Infrastrukturë':
    case 'Urbanizëm':
    case 'Ambient':
    case 'Infrastrukturë rrugore':
      return 'Komuna / Drejtoria Përkatëse';
    case 'Shërbime Publike':
      return 'Kompanitë Regjionale (KEDS, KRU, etj.)';
    case 'Siguri Publike':
    case 'Transport & Trafik':
      return 'Policia e Kosovës / MPB';
    case 'Shëndetësi':
      return 'Ministria e Shëndetësisë';
    case 'Arsim':
      return 'Ministria e Arsimit, Shkencës dhe Teknologjisë';
    case 'Ekonomi':
      return 'Ministria e Ekonomisë / ATK';
    default:
      return 'Institucionet e Tjera';
  }
};

const buildHTMLContent = (reports: Report[], subtitle: string): string => {
  const groupedReports = reports.reduce((acc, report) => {
    const organ = getCompetentOrgan(report.category || '');
    if (!acc[organ]) acc[organ] = [];
    acc[organ].push(report);
    return acc;
  }, {} as Record<string, Report[]>);

  let htmlContent = `
  <!DOCTYPE html>
  <html lang="sq">
  <head>
    <meta charset="UTF-8">
    <title>Dosja Zyrtare e Raporteve - Qendra e Miratimeve</title>
    <style>
      body { font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #111; line-height: 1.5; background: #fff; }
      .header { border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
      .header h1 { color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; }
      .header p { margin: 0; color: #555; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      h2 { color: #4f46e5; margin-top: 50px; border-bottom: 2px solid #eee; padding-bottom: 10px; text-transform: uppercase; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
      .report-card { border: 2px solid #0f172a; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; background: #fdfdfd; box-shadow: 6px 6px 0px #0f172a; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
      th { width: 140px; font-weight: 800; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
      .status { padding: 4px 10px; font-weight: 900; text-transform: uppercase; font-size: 11px; background: #0f172a; color: white; display: inline-block; letter-spacing: 1px; margin-top: 8px; }
      .images { margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
      .images img { max-width: 300px; max-height: 250px; border: 2px solid #0f172a; object-fit: cover; }
      .desc-title { font-weight: 900; text-transform: uppercase; font-size: 14px; margin-bottom: 5px; color: #0f172a; letter-spacing: 0.5px; margin-top: 20px; }
      .desc-content { font-size: 14px; color: #333; margin: 0; white-space: pre-wrap; }
      @media print {
        body { margin: 0; }
        .report-card { border: 2px solid #000; box-shadow: none; margin-bottom: 30px; }
        .header, h2 { break-before: auto; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Raportet dhe Aprovimet Qytetare</h1>
      <p>Gjeneruar më: ${new Date().toLocaleString('sq-AL')} | ${subtitle}</p>
    </div>
  `;

  for (const [organ, reportsGroup] of Object.entries(groupedReports)) {
    htmlContent += `<h2>Institucioni Përgjegjës: ${organ.toUpperCase()}</h2>`;
    htmlContent += `<p style="font-weight: bold; font-size: 14px; text-transform: uppercase;">Totali i raporteve: <span style="background: #0f172a; color: white; padding: 2px 8px; border-radius: 12px;">${reportsGroup.length}</span></p>`;
    
    reportsGroup.forEach(r => {
      const imagesMarkup = r.images && r.images.length > 0 
        ? `<div class="images">${r.images.map(img => `<img src="${img}" alt="Dëshmi" />`).join('')}</div>`
        : '';

      htmlContent += `
      <div class="report-card">
        <div class="grid">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">Referenca: ${r.id}</h3>
            <h4 style="margin: 5px 0 0 0; font-size: 16px; font-weight: 600; color: #e11d48; text-transform: uppercase;">${r.title}</h4>
            <span class="status">${r.status}</span>
            <table>
              <tr><th>Kategoria</th><td><strong>${r.category}</strong></td></tr>
              <tr><th>Urgjenca</th><td>${r.urgency}</td></tr>
              <tr><th>Data e Hapjes</th><td>${new Date(r.createdAt).toLocaleString('sq-AL')}</td></tr>
              <tr><th>Raportuesi</th><td>${r.isAnonymous ? 'Anonim (Mbrojtur)' : r.authorName}</td></tr>
            </table>
          </div>
          <div>
            <div class="desc-title">Të Dhënat Gjeografike</div>
            <table>
              <tr><th>Komuna</th><td>${r.location?.municipality || 'N/A'}</td></tr>
              <tr><th>Adresa</th><td>${r.location?.address || 'N/A'}</td></tr>
            </table>
            <div class="desc-title">Përshkrimi</div>
            <p class="desc-content">${r.description}</p>
          </div>
        </div>
        ${imagesMarkup}
      </div>
      `;
    });
  }

  htmlContent += `
  </body>
  </html>
  `;

  return htmlContent;
};

export const exportToHTML = (filename: string, reports: Report[], subtitle: string) => {
  const html = buildHTMLContent(reports, subtitle);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.html`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (reports: Report[], subtitle: string) => {
  const html = buildHTMLContent(reports, subtitle);
  const printWindow = window.open('', '', 'width=900,height=700');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};
