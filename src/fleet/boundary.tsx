import { Component, type ReactNode } from "react";
import { accessMessage } from "./access";

type State = { message: string | null };

export class FleetBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: accessMessage(error) };
  }

  render() {
    if (this.state.message) {
      return <p className="empty">{this.state.message}</p>;
    }
    return this.props.children;
  }
}
