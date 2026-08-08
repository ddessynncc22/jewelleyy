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
        boxShadow: "0 8px 24px rgba(28,25,15,0.12)",
        border: "1px solid var(--color-border)",
        background: "var(--color-card)",
        color: "var(--color-text)",
      },
      success: {
        iconTheme: { primary: "#16a34a", secondary: "#fff" },
      },
      error: {
        iconTheme: { primary: "#dc2626", secondary: "#fff" },
      },
    }}
  />
);
export default Toast;