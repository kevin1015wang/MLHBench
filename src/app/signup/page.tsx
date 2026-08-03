import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BenchLogo } from "@/components/icons/bench-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create guest account | Bench",
};

export const dynamic = "force-dynamic";

interface SignupPageProps {
  readonly searchParams?: Promise<{ error?: string }>;
}

export default async function SignupPage(props: SignupPageProps) {
  const searchParams = await props.searchParams;
  const session = await getSession();

  if (session) {
    redirect("/events");
  }

  const error = searchParams?.error;

  let errorMessage: string | undefined;
  if (error === "invalid_username") {
    errorMessage =
      "Username must be 3-32 characters (letters, numbers, _ or -).";
  } else if (error === "weak_password") {
    errorMessage = "Password must be at least 8 characters.";
  } else if (error === "username_taken") {
    errorMessage = "That username is already taken.";
  } else if (error) {
    errorMessage = "We couldn't create your account. Please try again.";
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-card/60 lg:block lg:border-r lg:border-border/70">
          <Image
            src="/background.webp"
            alt="Bench background"
            fill
            priority
            sizes="100vh"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-12 p-8 sm:p-12 lg:order-2 lg:p-16">
          <div className="flex items-center gap-3 self-left">
            <BenchLogo className="w-8 h-4 text-(--mlh-dark-grey) dark:text-(--mlh-white)" />
            <h1 className="text-2xl font-bold font-headline text-(--mlh-dark-grey) dark:text-(--mlh-white)">
              Bench
            </h1>
          </div>

          <div className="flex flex-1 items-center">
            <div className="w-full max-w-md space-y-8 mx-auto text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Create a guest account
                </h1>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be able to sign in once created, but won&apos;t
                  see any events until the organizer grants you access.
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-900 text-left">
                  {errorMessage}
                </div>
              )}

              <form
                action="/api/auth/guest-signup"
                method="post"
                className="flex flex-col items-stretch space-y-3 max-w-xs mx-auto w-full text-left"
              >
                <div className="space-y-1">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="h-11">
                  Create account
                </Button>
              </form>

              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="underline hover:text-foreground">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
