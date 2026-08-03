import { useState } from "react";

import { useForm } from "react-hook-form";

import { useNavigate, Link } from "react-router-dom";

import toast from "react-hot-toast";

import { LogIn } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";

import { login as loginApi } from "../../services/authService";

import Button from "../../components/ui/Button";
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Welcome back</h2>
      {wrongHost && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{wrongHost.message}</p>
          {wrongHost.redirectTo && (
            <a
              href={wrongHost.redirectTo}
              className="mt-2 inline-block font-semibold text-[var(--color-primary-hover)] underline underline-offset-2"
            >
              Go to {wrongHost.shopName || wrongHost.redirectTo}
            </a>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            {...register("email", { required: "Email is required" })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            placeholder="Enter your email"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <input
            type="password"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 6, message: "Min 6 characters" },
            })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            placeholder="Enter your password"
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full" icon={LogIn}>
          Sign In
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-gray-500">
        No account?{" "}
        <Link
          to="/register"
          className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium"
        >
          Request an account
        </Link>
      </div>
    </div>
  );
}
