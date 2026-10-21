import { dt } from '@/src/lib/dt';
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<any, any> {
  props: any;
  state: any;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): any {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled runtime error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.hash = '/';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-white">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 p-8 rounded-2xl shadow-xl space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm dark:shadow-none">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white title-serif">{dt(`Ndodhi një gabim`)}<span className="text-rose-600">.</span>
              </h1>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{dt(`Platforma hasi në një vështirësi teknike`)}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl p-4 text-left">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{dt(`Detajet e Gabimit:`)}</p>
              <p className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold break-all whitespace-pre-wrap">
                {this.state.error?.message || "Gabim i panjohur në renderim"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />{dt(`RI-NGARKON`)}
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-white font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 transition-colors shadow-sm dark:shadow-none cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />{dt(`BALLINA`)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
