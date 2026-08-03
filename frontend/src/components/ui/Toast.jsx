import { Toaster } from "react-hot-toast";

const Toast = () => (
  <Toaster
    position="top-right"
    gutter={12}
    containerClassName=""
    toastOptions={{
      duration: 4000,
      style: {
        borderRadius: "12px",
        padding: "14px 18px",
        fontSize: "14px",
        fontWeight: "500",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        border: "1px solid var(--color-border)",
        background: "var(--color-card)",
        color: "var(--color-text)",
      },
      success: {
        iconTheme: { primary: "#10b981", secondary: "#fff" },
      },
      error: {
        iconTheme: { primary: "#ef4444", secondary: "#fff" },
      },
    }}
  />
);
export default Toast;
