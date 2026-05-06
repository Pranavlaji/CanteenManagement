"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
          >
            😵
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              color: "#f8fafc",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#94a3b8",
              marginBottom: "1.5rem",
              maxWidth: "400px",
            }}
          >
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <code
            style={{
              display: "block",
              padding: "0.75rem 1rem",
              background: "#1e293b",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
              color: "#f87171",
              marginBottom: "1.5rem",
              maxWidth: "500px",
              overflow: "auto",
              wordBreak: "break-word",
            }}
          >
            {this.state.error?.message || "Unknown error"}
          </code>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: "0.75rem 2rem",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
