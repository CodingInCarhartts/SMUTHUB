import { Component, type ReactNode, type ErrorInfo } from 'react';
import { BUNDLE_VERSION, BUNDLE_COMMIT_HASH } from '../services/update';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console (captured by DebugLogService automatically)
    console.error('[ErrorBoundary] Caught error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack || 'N/A');
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack || 'N/A');

    this.setState({ errorInfo });

    // Attempt to report to Supabase if available
    this.reportErrorToServer(error, errorInfo);
  }

  private async reportErrorToServer(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const errorReport = {
        type: 'ERROR_BOUNDARY_CRASH',
        error: {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
        version: BUNDLE_VERSION,
        commit_hash: BUNDLE_COMMIT_HASH,
        timestamp: new Date().toISOString(),
      };

      // Log the error report (will be captured by DebugLogService)
      console.log('[ErrorBoundary] Error report:', JSON.stringify(errorReport).substring(0, 500));
    } catch (reportError) {
      console.error('[ErrorBoundary] Failed to prepare error report:', reportError);
    }
  }

  private handleReload = (): void => {
    // Reset state and attempt to re-render children
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default fallback UI
      return (
        <view className="ErrorBoundary">
          <view className="ErrorBoundary-content">
            <text className="ErrorBoundary-icon">💔</text>
            <text className="ErrorBoundary-title">Something went wrong</text>
            <text className="ErrorBoundary-message">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </text>
            <text className="ErrorBoundary-version">
              v{BUNDLE_VERSION} ({BUNDLE_COMMIT_HASH})
            </text>
            <view className="ErrorBoundary-button" bindtap={this.handleReload}>
              <text className="ErrorBoundary-button-text">Try Again</text>
            </view>
          </view>
        </view>
      );
    }

    return this.props.children;
  }
}
