import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { STEP } from '../config/workflowSteps.js';
import { useToast } from '../components/layout/Toast';
import { downloadSessionJson } from '../utils/sessionExport';
import ExportCustomerPackMenu from '../components/report/ExportCustomerPackMenu';
import ReportDeliverablePreview from '../components/report/ReportDeliverablePreview';
import { useCustomerReportData } from '../hooks/useCustomerReportData';

export default function ReportPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const hasReportPath = state.reportPathExplicit && state.selectedPlanIndex != null;
  const data = useCustomerReportData({ hideZeroUnconfigured: true });

  const handleSaveAndQuit = useCallback(() => {
    downloadSessionJson(state);
    toast.success('Session saved');
    navigate('/');
  }, [state, navigate, toast]);

  if (!hasReportPath) {
    return (
      <div className="page-viewport">
        <div className="page-header shrink-0 no-print">
          <div>
            <h2>Report</h2>
            <WorkflowStepIndicator currentStep={STEP.REPORT} />
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', payload: STEP.PATHS })}
            className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
          >
            <ChevronLeft size={14} /> Architecture Paths
          </button>
        </div>
        <div className="page-scroll flex items-center justify-center p-8">
          <div className="card-compact max-w-md text-center py-10 px-6">
            <Layers className="mx-auto mb-3 text-[var(--cast-accent)]" size={28} />
            <p className="text-empty-title m-0">No architecture path selected</p>
            <p className="text-empty-body mt-2 mb-4">
              Compare Crawl, Walk, and Run on Architecture Paths, then choose{' '}
              <strong>Select for report</strong> to preview your customer deliverable here.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => dispatch({ type: 'SET_STEP', payload: STEP.PATHS })}
            >
              Go to Architecture Paths
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2>Report</h2>
            <WorkflowStepIndicator currentStep={STEP.REPORT} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportCustomerPackMenu
            state={state}
            onToast={(msg, type) => {
              if (type === 'error') toast.error(msg);
              else if (type === 'info') toast.info(msg);
              else toast.success(msg);
            }}
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', payload: STEP.PATHS })}
            className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={handleSaveAndQuit}
            className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
          >
            <Save size={14} /> Save and Quit
          </button>
        </div>
      </div>

      <div className="page-scroll py-4 md:py-6">
        <div className="page-content-width">
        <ReportDeliverablePreview data={data} />
        </div>
      </div>
    </div>
  );
}
