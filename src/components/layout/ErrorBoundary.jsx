import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-[300px] p-8">
        <div className="card max-w-md w-full text-center p-6 space-y-4">
          <AlertTriangle size={32} className="mx-auto text-[var(--cast-warning)]" />
          <h2 className="text-section-title">Something went wrong</h2>
          <p className="text-label text-[var(--cast-text-muted)]">
            {this.props.fallbackMessage || 'An unexpected error occurred. Your session data is safe.'}
          </p>
          {this.state.error?.message && (
            <pre className="text-badge text-[var(--cast-critical)] bg-[var(--cast-panel-alt)] p-2 rounded overflow-x-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="btn-primary inline-flex items-center gap-2 text-label px-4 py-2"
          >
            <RotateCcw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }
}
