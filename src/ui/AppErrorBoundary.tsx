import { Component, type ErrorInfo, type ReactNode } from "react";
import { setBearerToken } from "../platform/bearer";

type Props = { children: ReactNode };
type State = { failed: boolean; detail: string | null };

/**
 * Application-level boundary. Never renders stack traces, tokens, or raw backend bodies.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, detail: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      detail: import.meta.env.DEV ? error?.message || "Unknown render error" : null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[AppErrorBoundary]", error, info.componentStack);
    }
  }

  private recover = () => {
    setBearerToken(null);
    this.setState({ failed: false, detail: null });
    window.location.assign("/auth/login");
  };

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <section className="page" role="alert">
        <header className="page-head">
          <h1>Something went wrong</h1>
          <p>The console stayed closed to operators. Clear the session and reload to continue.</p>
          {this.state.detail ? <p className="meta">{this.state.detail}</p> : null}
        </header>
        <button type="button" onClick={this.recover}>
          Clear session and reload
        </button>
      </section>
    );
  }
}
