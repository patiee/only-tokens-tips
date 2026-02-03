"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <div className="inline-flex p-3 rounded-full bg-red-500/20 mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Something went wrong</h3>
                    <p className="text-zinc-400 text-sm mb-4">
                        The widget encountered an error. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                    >
                        Try Again
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-4 p-4 bg-black/50 rounded text-left text-xs text-red-300 overflow-auto max-h-40">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
