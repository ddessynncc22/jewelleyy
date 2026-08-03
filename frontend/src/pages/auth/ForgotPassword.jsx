import { useState } from "react";

import { useForm } from "react-hook-form";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

import { forgotPassword } from "../../services/authService";

import Button from "../../components/ui/Button";

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
      <div className="text-center py-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Request sent
        </h2>
        <p className="text-sm text-gray-500 mb-6">
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
      <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot password?</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter your account email and we will notify the administrator to reset
        your password for you.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Name
          </label>
          <input
            {...register("name")}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            placeholder="Your name (optional)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            {...register("email", { required: "Email is required" })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            placeholder="Enter your email"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
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
      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-500">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <span>
          No account?{" "}
          <Link
            to="/register"
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            Register
          </Link>
        </span>
      </div>
    </div>
  );
}
