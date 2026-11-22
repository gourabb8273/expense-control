import { useState } from 'react';
import { useToast } from '../context/ToastContext';

/** Inline the computed styles SVG text/shapes need, so the snapshot matches the screen (CSS vars/classes). */
function inlineSvgStyles(root) {
  const restore = [];
  root.querySelectorAll('svg, svg *').forEach((el) => {
    const cs = getComputedStyle(el);
    const prev = el.getAttribute('style');
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-family', 'paint-order'];
    const style = props
      .map((p) => {
        const v = cs.getPropertyValue(p);
        return v ? `${p}:${v}` : '';
      })
      .filter(Boolean)
      .join(';');
    el.setAttribute('style', `${prev ? `${prev};` : ''}${style}`);
    restore.push([el, prev]);
  });
  return () =>
    restore.forEach(([el, prev]) => (prev == null ? el.removeAttribute('style') : el.setAttribute('style', prev)));
}

async function snapshot(el) {
  const { default: html2canvas } = await import('html2canvas');
  const undo = inlineSvgStyles(el);
  try {
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#020617';
    return await html2canvas(el, {
      backgroundColor: bg,
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      windowWidth: el.scrollWidth,
      ignoreElements: (node) =>
        node.classList?.contains('review-export-bar') || node.matches?.('.review-hero > button') || node.dataset?.html2canvasIgnore != null,
    });
  } finally {
    undo();
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/**
 * Save the WHOLE review (summary + every detail card) as one tall image or a multi-page PDF.
 * Reads what's on screen only; with "Hide amounts" on, the export hides them too.
 */
export default function ReviewExport({ targetRef, year }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const asImage = async () => {
    if (!targetRef.current) return;
    setBusy('image');
    try {
      const canvas = await snapshot(targetRef.current);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], `${year}-full-review.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${year} in review` });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      download(blob, file.name);
      toast.success('Full review saved as image');
    } catch (err) {
      console.error('Review image failed', err);
      toast.error('Could not create the image');
    } finally {
      setBusy(null);
    }
  };

  const asPdf = async () => {
    if (!targetRef.current) return;
    setBusy('pdf');
    try {
      const canvas = await snapshot(targetRef.current);
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const imgW = pageW - margin * 2;
      const pxPerPt = canvas.width / imgW;
      const sliceH = Math.floor((pageH - margin * 2) * pxPerPt);
      const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#020617';
      for (let y = 0, page = 0; y < canvas.height; y += sliceH, page += 1) {
        const h = Math.min(sliceH, canvas.height - y);
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = h;
        part.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) pdf.addPage();
        pdf.setFillColor(bg);
        pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, h / pxPerPt);
      }
      pdf.save(`${year}-full-review.pdf`);
      toast.success('Full review saved as PDF');
    } catch (err) {
      console.error('Review PDF failed', err);
      toast.error('Could not create the PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="review-export-bar">
      <span className="muted small">Save the complete review (everything below):</span>
      <div className="review-export-actions">
        <button type="button" className="ghost-btn small" onClick={asImage} disabled={!!busy}>
          {busy === 'image' ? 'Preparing…' : 'Full review · Image'}
        </button>
        <button type="button" className="ghost-btn small" onClick={asPdf} disabled={!!busy}>
          {busy === 'pdf' ? 'Preparing…' : 'Full review · PDF'}
        </button>
      </div>
    </div>
  );
}
