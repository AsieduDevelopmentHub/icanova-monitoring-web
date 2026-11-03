import { Component, type ReactNode } from "react";
import { accessMessage } from "./access";
import { extractConvexErrorText } from "../auth/convexError";

type State = { message: string | null; detail: string | null };

export class FleetBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null, detail: null };

  static getDerivedStateFromError(error: unknown): State {
    const detail = extractConvexErrorText(error) || (error instanceof Error ? error.message : String(error ?? ""));
    if (import.meta.env.DEV) {
      console.error("[FleetBoundary]", error);
    }
    return { message: accessMessage(error), detail };
  }

  private retry = () => {
    this.setState({ message: null, detail: null });
  };

  render() {
    if (this.state.message) {
      return (
        <div className="stack" role="alert">
          <p className="empty">{this.state.message}</p>
          {import.meta.env.DEV && this.state.detail ? (
            <p className="meta tech">{this.state.detail}</p>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={this.retry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
