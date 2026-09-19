import { Component, type ReactNode } from "react";

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="py-20 px-6 text-center">
          <h1 className="text-2xl font-bold mb-4">This page couldn’t load</h1>
          <p role="alert" className="text-[var(--color-github-muted)] mb-6">
            Check your connection and reload to try again.
          </p>
          <button onClick={() => window.location.reload()} className="bg-[var(--color-brand)] text-white px-6 py-3 rounded-lg">
            Reload page
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
