import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Rapid Resolve Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('rapidresolve_citizen_tickets');
      sessionStorage.removeItem('rapidresolve_user');
      sessionStorage.removeItem('rapidresolve_user_token');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const errorMessage =
        err?.message ||
        (typeof err === 'object' ? JSON.stringify(err) : String(err || 'Unknown error'));

      return (
        <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-6 text-slate-200 my-4 shadow-xl max-w-4xl mx-auto">
          <div className="flex items-center gap-3 text-red-400 font-bold text-lg mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span>{this.props.fallbackTitle || 'Component Encountered an Issue'}</span>
          </div>
          <p className="text-sm text-slate-300 mb-3">
            An unexpected error occurred while rendering this section:
          </p>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-red-300 overflow-x-auto mb-4 whitespace-pre-wrap">
            {errorMessage}
            {this.state.errorInfo?.componentStack && (
              <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800 pt-2 font-mono">
                {this.state.errorInfo.componentStack}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
            <button
              type="button"
              onClick={this.handleHardReset}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Cache & Reload</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
