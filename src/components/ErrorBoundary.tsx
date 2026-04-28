import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : "Unknown error" };
  }

  componentDidCatch(err: unknown) {
    console.error("ErrorBoundary caught", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-extrabold text-gray-900">Something went wrong</div>
            <div className="mt-2 text-sm font-semibold text-gray-700">{this.state.message}</div>
            <div className="mt-4 text-xs font-semibold text-gray-500">
              Try refreshing. If it keeps happening, open DevTools Console and share the logs.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
