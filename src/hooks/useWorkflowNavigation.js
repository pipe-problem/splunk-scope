import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { navigateToWorkflowStep } from '../utils/workflowNavigation.js';

export function useWorkflowNavigation() {
  const navigate = useNavigate();
  const { dispatch } = useApp();

  function goToStep(stepIndex) {
    navigateToWorkflowStep(navigate, dispatch, stepIndex);
  }

  return { goToStep, navigate };
}
