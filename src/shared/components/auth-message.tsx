type AuthMessageProps = { erro?: string; sucesso?: string };

export function AuthMessage({ erro, sucesso }: AuthMessageProps) {
  const message = erro ?? sucesso;
  if (!message) return null;
  return (
    <p className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${erro ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/35 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200"}`} role="status">
      {message}
    </p>
  );
}
