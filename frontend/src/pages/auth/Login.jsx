import { useState } from "react";

import { useForm } from "react-hook-form";

import { useNavigate, Link } from "react-router-dom";

import toast from "react-hot-toast";

import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "../../hooks/useAuth";

import { login as loginApi } from "../../services/authService";

import Button from "../../components/ui/Button";

const fieldClass =
  "peer h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-10 text-sm text-[var(--color-text)] placeholder-[var(--color-ink-400)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:outline-none focus:ring-4 focus:ring-[var(--color-gold-500)]/15";

const labelClass =
  "mb-1.5 block text-[13px] font-medium text-[var(--color-text)]";

const inputIconClass =
  "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-400)] transition-colors peer-focus:text-[var(--color-gold-600)]";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Set when the account is valid but belongs to a different address, so we can
  // offer a link instead of a dead-end error.
  const [wrongHost, setWrongHost] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const onSubmit = async (data) => {
    setLoading(true);
    setWrongHost(null);
    try {
      const res = await loginApi({
        email: data.email,
        password: data.password,
      });
      const { token, user } = res.data.data;
      login(token, user);
      toast.success("Login successful");
      navigate("/");
    } catch (err) {
      const body = err.response?.data;
      const message = body?.message || "Login failed";
      if (err.response?.status === 403) {
        setWrongHost({ message, redirectTo: body?.data?.redirectTo || null, shopName: body?.data?.shopName || null });
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-600)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-gold-500)]" />
          Secure access
        </p>
        <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight text-[var(--color-text)]">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          Sign in to your shop dashboard to continue.
        </p>
      </div>

      {wrongHost && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p>{wrongHost.message}</p>
            {wrongHost.redirectTo && (
              <a
                href={wrongHost.redirectTo}
                className="mt-1.5 inline-block font-semibold text-[var(--color-gold-700)] underline underline-offset-2"
              >
                Go to {wrongHost.shopName || wrongHost.redirectTo}
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="login-email">
            Email address
          </label>
          <div className="relative">
            <Mail className={inputIconClass} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              {...register("email", { required: "Email is required" })}
              className={fieldClass}
              placeholder="you@shop.com"
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-[13px] font-medium text-[var(--color-text)]" htmlFor="login-password">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[var(--color-gold-700)] transition-colors hover:text-[var(--color-gold-800)]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className={inputIconClass} />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "Min 6 characters" },
              })}
              className={fieldClass}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--color-ink-400)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-ink-600)]"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="group flex cursor-pointer select-none items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-ink-300)] accent-[var(--color-gold-600)] focus:ring-[var(--color-gold-500)]"
            />
            <span className="transition-colors group-hover:text-[var(--color-text)]">
              Remember me
            </span>
          </label>
        </div>

        <Button
          type="submit"
          loading={loading}
          className="h-11 w-full bg-gradient-gold text-[15px] font-semibold shadow-[var(--shadow-gold-lg)] transition-all duration-200 hover:-translate-y-px hover:brightness-105"
          icon={loading ? null : <ArrowRight className="h-4 w-4" />}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-7 border-t border-[var(--color-border)] pt-6 text-center text-sm text-[var(--color-text-secondary)]">
        <span>New to Jewelcore? </span>
        <Link
          to="/register"
          className="font-semibold text-[var(--color-gold-700)] transition-colors hover:text-[var(--color-gold-800)]"
        >
          Request an account
        </Link>
      </div>
    </div>
  );
}
