import { Component, type ErrorInfo, type ReactNode } from "react";
import { setBearerToken } from "../platform/bearer";

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Application-level boundary. Never renders stack traces, tokens, or raw backend bodies.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Intentionally no console dump of sensitive payloads.
  }

  private recover = () => {
    setBearerToken(null);
    this.setState({ failed: false });
    window.location.assign("/");
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
        </header>
        <button type="button" onClick={this.recover}>
          Clear session and reload
        </button>
      </section>
    );
  }
}
