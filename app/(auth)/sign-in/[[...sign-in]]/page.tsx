import { Suspense } from "react";
import Image from "next/image";

import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-white shadow-theme-md">
            <Image
              src="/mysigrid-logo.png"
              alt="MySigrid"
              width={40}
              height={40}
              priority
            />
          </div>
          <h1 className="text-title-md font-semibold text-gray-900 dark:text-white">
            MySigrid
          </h1>
          <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
            Sign in to continue to your dashboard.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <Suspense
            fallback={
              <div className="h-12 w-full animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
            }
          >
            <SignInForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-theme-xs text-gray-500 dark:text-gray-400">
          <a
            href="https://www.mysigrid.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Privacy Policy
          </a>
          <span className="mx-2">·</span>
          <a
            href="https://www.mysigrid.com/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Terms &amp; Conditions
          </a>
        </p>
      </div>
    </div>
  );
}
