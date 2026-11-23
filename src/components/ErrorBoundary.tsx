import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Đã xảy ra lỗi không mong muốn.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Application ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Không thể tải dữ liệu học tập
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Hệ thống ghi nhận sự cố truy cập dữ liệu hoặc kết nối. Vui lòng tải lại
              trang hoặc đăng nhập lại tài khoản Google.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 cursor-pointer"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
