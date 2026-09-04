import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-6 text-slate-200 my-4 shadow-xl">
          <div className="flex items-center gap-3 text-red-400 font-bold text-lg mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span>{this.props.fallbackTitle || 'Component Encountered an Issue'}</span>
          </div>
          <p className="text-sm text-slate-300 mb-3">
            An unexpected error occurred while rendering this section:
          </p>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-red-300 overflow-x-auto mb-4">
            {this.state.error?.toString()}
          </div>
          <button
            onClick={this.handleReset}
            className="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
