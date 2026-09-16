import { Component } from 'react';

/**
 * Catches render errors so one failure does not white-screen the product.
 *
 * Most valuable around lazy routes: a chunk request that fails — a stale
 * cache after a deploy, a connection dropped mid-navigation — throws during
 * render, and with no boundary above it React unmounts the entire tree. The
 * user is left on a blank page with nothing to act on.
 *
 * Must be a class. There is no hook equivalent of componentDidCatch.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" role="alert">
        <h2 className="text-[18px] font-bold text-ink-900">Something went wrong</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          This part of the app failed to load. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 cursor-pointer rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px]
            font-semibold text-white hover:bg-brand-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
