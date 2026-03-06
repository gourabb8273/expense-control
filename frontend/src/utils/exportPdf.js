import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// jsPDF default font doesn't support ₹ (renders as ¹), so use "Rs." for PDF
const RU = 'Rs. ';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CHART_MAX_W = 182;
const CHART_MAX_H = 95;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;

// Scale image to fit inside max box while preserving aspect ratio
function fitImageSize(imgW, imgH, maxW, maxH) {
  if (!imgW || !imgH || imgW <= 0 || imgH <= 0) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return { w: imgW * scale, h: imgH * scale };
}

function addChartImagesToPdf(doc, chartImages, startY) {
  let y = startY;
  if (!chartImages || chartImages.length === 0) return y;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Charts', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  chartImages.forEach(({ title, dataUrl, width: imgW, height: imgH }) => {
    const { w, h } = fitImageSize(imgW, imgH, CHART_MAX_W, CHART_MAX_H);
    if (y + h + 4 > PAGE_H - 22) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.text(title, MARGIN, y);
    y += 5;
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      doc.addImage(base64, 'PNG', MARGIN, y, w, h);
      y += h + 10;
    } catch (_) {
      y += 5;
    }
  });
  return y;
}

export async function exportMonthlyPdf({ year, month, monthlySummary, transactions, api, chartImages, cashflow = 0 }) {
  const doc = new jsPDF();
  const monthLabel = MONTH_NAMES[month] || month;
  const ms = monthlySummary || {};
  const totalInv = ms.totalInvestment ?? 0;
  const totalExp = ms.totalExpense ?? 0;
  const totalSum = totalInv + totalExp;
  const invPct = totalSum > 0 ? Math.round((totalInv / totalSum) * 100) : 0;
  const expPct = totalSum > 0 ? Math.round((totalExp / totalSum) * 100) : 0;
  const cashflowNum = Number(cashflow) || 0;
  const remaining = cashflowNum - totalSum;

  // ——— Page 1: Executive summary ———
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Control', MARGIN, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Monthly Report', MARGIN, 30);
  doc.setFontSize(11);
  doc.text(`${monthLabel} ${year}`, MARGIN, 37);
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, 42, PAGE_W - MARGIN, 42);
  let y = 50;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Month cashflow', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text(`Cashflow (in bank): ${RU}${cashflowNum.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Expense: ${RU}${totalExp.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Investment: ${RU}${totalInv.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Total (Expense + Investment): ${RU}${totalSum.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Remaining: ${RU}${remaining.toLocaleString('en-IN')}`, MARGIN, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Summary', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text(`Split: Investment ${invPct}%  |  Expense ${expPct}%`, MARGIN, y);
  y += 14;

  // ——— 1. Transactions (main table) ———
  if (y > PAGE_H - 80) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Transactions', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 7;

  autoTable(doc, {
    startY: y,
    head: [['Type', 'Category', 'Tag', 'Amount', 'Date', 'Description']],
    body: (transactions || []).map((tx) => [
      tx.type === 'investment' ? 'Investment' : 'Expense',
      tx.category || '',
      tx.tag || '—',
      `${RU}${Number(tx.amount).toLocaleString('en-IN')}`,
      formatDate(tx.date),
      (tx.description || '').slice(0, 30),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = doc.lastAutoTable.finalY + 12;

  // ——— 2. Balance sheet ———
  if (y > PAGE_H - 60) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Balance sheet · ${monthLabel} ${year}`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  try {
    const bsRes = await api.get('/balance-sheet', { params: { year, month } });
    const bs = bsRes.data;
    const totalAssets = (bs.assets || []).reduce((s, i) => s + (i.value || 0), 0);
    const totalDebts = (bs.debts || []).reduce((s, i) => s + (i.value || 0), 0);
    const hasRows = (bs.assets && bs.assets.length > 0) || (bs.debts && bs.debts.length > 0);
    if (hasRows && (totalAssets > 0 || totalDebts > 0)) {
      autoTable(doc, {
        startY: y,
        head: [['Assets', `Value (${RU})`]],
        body: (bs.assets || []).map((a) => [a.name, (a.value || 0).toLocaleString('en-IN')]),
        theme: 'plain',
        margin: { left: MARGIN },
      });
      const ay = doc.lastAutoTable.finalY + 4;
      autoTable(doc, {
        startY: ay,
        head: [['Debts', `Value (${RU})`]],
        body: (bs.debts || []).map((d) => [d.name, (d.value || 0).toLocaleString('en-IN')]),
        theme: 'plain',
        margin: { left: MARGIN },
      });
      doc.setFontSize(10);
      doc.text(`Total assets: ${RU}${totalAssets.toLocaleString('en-IN')}  |  Total debts: ${RU}${totalDebts.toLocaleString('en-IN')}  |  Net worth: ${RU}${(totalAssets - totalDebts).toLocaleString('en-IN')}`, MARGIN, doc.lastAutoTable.finalY + 6);
      y = doc.lastAutoTable.finalY + 12;
    } else {
      doc.setFontSize(10);
      doc.text('No balance sheet data for this month. Add and save in the app.', MARGIN, y);
      y += 10;
    }
  } catch (_) {
    doc.setFontSize(10);
    doc.text('Balance sheet could not be loaded. Check your connection and try again.', MARGIN, y);
    y += 10;
  }

  // ——— 3. Category breakdown ———
  if (y > PAGE_H - 60) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Category breakdown', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  if (ms.investmentCategories?.length) {
    doc.setFontSize(10);
    doc.text('Investment by category', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Category', `Total (${RU})`]],
      body: ms.investmentCategories.map((c) => [c.category, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ms.expenseCategories?.length) {
    doc.setFontSize(10);
    doc.text('Expense by category', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Category', `Total (${RU})`]],
      body: ms.expenseCategories.map((c) => [c.category, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ms.investmentByTag?.length) {
    doc.setFontSize(10);
    doc.text('Investment by tag', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tag', `Total (${RU})`]],
      body: ms.investmentByTag.map((c) => [c.tag, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ms.expenseByTag?.length) {
    doc.setFontSize(10);
    doc.text('Expense by tag', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tag', `Total (${RU})`]],
      body: ms.expenseByTag.map((c) => [c.tag, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ——— 4. All charts (last) ———
  if (chartImages?.length) {
    doc.addPage();
    y = 20;
    addChartImagesToPdf(doc, chartImages, y);
  }

  doc.save(`report-${monthLabel}-${year}.pdf`);
}

export async function exportYearlyPdf({ year, yearlySummary, api, chartImages, yearlyCashflow }) {
  const doc = new jsPDF();
  const ys = yearlySummary || {};
  const monthly = ys.monthly || [];
  const totalInv = monthly.reduce((s, m) => s + (m.totalInvestment || 0), 0);
  const totalExp = monthly.reduce((s, m) => s + (m.totalExpense || 0), 0);
  const cashflowArr = Array.isArray(yearlyCashflow) && yearlyCashflow.length >= 12
    ? yearlyCashflow.slice(0, 12)
    : [...(yearlyCashflow || []), ...Array(12).fill(0)].slice(0, 12);
  const totalCashflow = cashflowArr.reduce((s, v) => s + (Number(v) || 0), 0);
  const totalSum = totalInv + totalExp;
  const remainingBalance = totalCashflow - totalSum;

  // ——— Page 1: Executive summary ———
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Control', MARGIN, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Yearly Report', MARGIN, 30);
  doc.setFontSize(11);
  doc.text(String(year), MARGIN, 37);
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, 42, PAGE_W - MARGIN, 42);
  let y = 50;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Year cashflow', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text(`Total cashflow (entered): ${RU}${totalCashflow.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Total investment: ${RU}${totalInv.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Total expense: ${RU}${totalExp.toLocaleString('en-IN')}`, MARGIN, y);
  y += 6;
  doc.text(`Remaining balance: ${RU}${remainingBalance.toLocaleString('en-IN')}`, MARGIN, y);
  y += 14;

  // ——— 1. Month-wise summary (main table) ———
  if (y > PAGE_H - 80) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Month-wise summary', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 7;
  const monthRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
    const monthLabel = MONTH_NAMES[m] || m;
    const row = monthly.find((x) => x.month === m) || {};
    const inv = row.totalInvestment || 0;
    const exp = row.totalExpense || 0;
    const cf = Number(cashflowArr[m - 1]) || 0;
    const total = inv + exp;
    const remaining = cf - total;
    return [
      monthLabel,
      cf.toLocaleString('en-IN'),
      inv.toLocaleString('en-IN'),
      exp.toLocaleString('en-IN'),
      total.toLocaleString('en-IN'),
      remaining.toLocaleString('en-IN'),
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [['Month', `Cashflow (${RU})`, `Investment (${RU})`, `Expense (${RU})`, `Total (${RU})`, `Remaining (${RU})`]],
    body: monthRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = doc.lastAutoTable.finalY + 12;

  // ——— 2. Balance sheet summary ———
  if (y > PAGE_H - 60) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Balance sheet summary · ${year}`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  try {
    const bsRes = await api.get(`/balance-sheet/year/${year}`);
    const byMonth = bsRes.data?.byMonth || {};
    const hasBs = Object.keys(byMonth).some((m) => {
      const row = byMonth[m];
      return (row.totalAssets || 0) > 0 || (row.totalDebts || 0) > 0;
    });
    if (hasBs) {
      autoTable(doc, {
        startY: y,
        head: [['Month', `Assets (${RU})`, `Debts (${RU})`, `Net worth (${RU})`]],
        body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
          const row = byMonth[m] || {};
          const a = row.totalAssets || 0;
          const d = row.totalDebts || 0;
          return [MONTH_NAMES[m], a.toLocaleString('en-IN'), d.toLocaleString('en-IN'), (a - d).toLocaleString('en-IN')];
        }),
        theme: 'plain',
        margin: { left: MARGIN },
      });
      y = doc.lastAutoTable.finalY + 12;
    } else {
      doc.setFontSize(10);
      doc.text('No balance sheet data for this year. Add and save in the app.', MARGIN, y);
      y += 10;
    }
  } catch (_) {
    doc.setFontSize(10);
    doc.text('Balance sheet summary could not be loaded.', MARGIN, y);
    y += 10;
  }

  // ——— 3. Category breakdown (year) ———
  if (y > PAGE_H - 60) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Category breakdown (year)', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  if (ys.investmentCategories?.length) {
    doc.setFontSize(10);
    doc.text('Investment by category', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Category', `Total (${RU})`]],
      body: ys.investmentCategories.map((c) => [c.category, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ys.expenseCategories?.length) {
    doc.setFontSize(10);
    doc.text('Expense by category', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Category', `Total (${RU})`]],
      body: ys.expenseCategories.map((c) => [c.category, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ys.investmentByTag?.length) {
    doc.setFontSize(10);
    doc.text('Investment by tag', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tag', `Total (${RU})`]],
      body: ys.investmentByTag.map((c) => [c.tag, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  if (ys.expenseByTag?.length) {
    doc.setFontSize(10);
    doc.text('Expense by tag', MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tag', `Total (${RU})`]],
      body: ys.expenseByTag.map((c) => [c.tag, c.total.toLocaleString('en-IN')]),
      theme: 'plain',
      margin: { left: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ——— 4. All charts (last) ———
  if (chartImages?.length) {
    doc.addPage();
    y = 20;
    addChartImagesToPdf(doc, chartImages, y);
  }

  doc.save(`report-year-${year}.pdf`);
}
