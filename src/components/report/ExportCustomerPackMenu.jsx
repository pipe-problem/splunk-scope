import { useState } from 'react';
import { Download } from 'lucide-react';
import { buildCustomerReportData } from '../../services/customerReportDataBuilder.js';
import { sanitizeCustomerReportData } from '../../services/customerReportSanitizer.js';
import {
  validateCustomerReportExport,
  canExportCustomerReport,
} from '../../services/customerReportExportValidation.js';
import { downloadSplunkPropositionPack } from '../../services/customerDeliverableExportBuilder.js';

/**
 * Single-button export — one zip with README, value proposition, and startup guide.
 */
export default function ExportCustomerPackMenu({ state, onToast }) {
  const [confirmWarnings, setConfirmWarnings] = useState(null);
  const [exporting, setExporting] = useState(false);

  function prepareExport() {
    const raw = buildCustomerReportData(state, { hideZeroUnconfigured: true });
    const data = sanitizeCustomerReportData(raw);
    const validation = validateCustomerReportExport(data);
    return { data, validation };
  }

  async function runDownload() {
    const { data, validation } = prepareExport();

    if (!canExportCustomerReport(validation)) {
      onToast(`Export blocked: ${validation.critical.join('; ')}`, 'error');
      return;
    }

    if (validation.warnings.length > 0) {
      setConfirmWarnings(validation.warnings);
      return;
    }

    setExporting(true);
    try {
      const filename = await downloadSplunkPropositionPack(data);
      onToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      onToast(err?.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function confirmWarningsDownload() {
    const { data } = prepareExport();
    setExporting(true);
    try {
      const filename = await downloadSplunkPropositionPack(data);
      onToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      onToast(err?.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
      setConfirmWarnings(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={runDownload}
        disabled={exporting}
        className="btn-primary flex items-center gap-1.5 text-sm shrink-0"
      >
        <Download size={14} />
        {exporting ? 'Preparing…' : 'Download Proposition Pack'}
      </button>

      {confirmWarnings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] p-5 shadow-xl">
            <h3 className="text-card-header mb-2">Export warnings</h3>
            <ul className="text-label text-[var(--cast-text-secondary)] space-y-1 mb-4 list-disc pl-4">
              {confirmWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setConfirmWarnings(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={confirmWarningsDownload}
                disabled={exporting}
              >
                Download anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
