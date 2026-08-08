import { useState } from "react";

import { useForm } from "react-hook-form";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

import { forgotPassword } from "../../services/authService";

import Button from "../../components/ui/Button";

const fieldClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 px-3.5 text-sm text-[var(--color-text)] placeholder-[var(--color-ink-400)] hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold-500)]/20 transition-all";

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await forgotPassword({
        email: data.email,
        name: data.name || undefined,
      });
      setSubmitted(true);
      toast.success("Request submitted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-6 text-center animate-fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="mb-2 text-xl font-bold tracking-tight text-[var(--color-text)]">
          Request sent
        </h2>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Your password reset request has been sent to the administrator.
          You will be able to sign in with the new password once it has been
          approved.
        </p>
        <Button
          onClick={() => setSubmitted(false)}
          variant="outline"
          className="w-full"
        >
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold tracking-tight text-[var(--color-text)]">
        Forgot password?
      </h2>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Enter your account email and we will notify the administrator to reset
        your password for you.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
            Name
          </label>
          <input
            {...register("name")}
            className={fieldClass}
            placeholder="Your name (optional)"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
            Email
          </label>
          <input
            type="email"
            {...register("email", { required: "Email is required" })}
            className={fieldClass}
            placeholder="Enter your email"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
          )}
        </div>
        <Button
          type="submit"
          loading={loading}
          className="w-full"
          icon={KeyRound}
        >
          Request Password Reset
        </Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[var(--color-gold-700)] hover:text-[var(--color-gold-800)]"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <span>
          No account?{" "}
          <Link
            to="/register"
            className="text-[var(--color-gold-700)] hover:text-[var(--color-gold-800)]"
          >
            Register
          </Link>
        </span>
      </div>
    </div>
  );
}