"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, fontWeight: 500 }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </div>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} className="btn btn-primary">
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
