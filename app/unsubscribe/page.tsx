import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-16 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          You&rsquo;ve been unsubscribed
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          We&rsquo;ve recorded your request to stop receiving emails from this
          sender. It may take up to 24 hours to take effect.
        </p>
        {u && (
          <p className="mt-4 text-xs text-gray-400">
            Reference: <span className="font-mono">{u}</span>
          </p>
        )}
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to MySigrid
        </Link>
      </div>
    </main>
  );
}
