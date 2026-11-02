import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";

type Props = { children: ReactNode; title?: string; body?: string };
type State = { failed: boolean; detail: string | null };

/** Isolates Convex/query render failures so the shell stays usable. */
export class QueryErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, detail: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      detail: import.meta.env.DEV ? error?.message || "Query failed" : null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[QueryErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <EmptyState
        title={this.props.title ?? "Data unavailable"}
        body={
          this.state.detail ??
          this.props.body ??
          "This section could not load. The rest of the console is still available."
        }
      />
    );
  }
}
