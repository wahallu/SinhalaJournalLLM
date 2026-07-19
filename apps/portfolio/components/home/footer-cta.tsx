import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function FooterCta() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          See what a Sinhala-native model can write.
        </h2>
        <div className="mt-8 flex justify-center">
          <Link
            href="/playground"
            className={buttonVariants({ size: "lg", className: "px-6" })}
          >
            Try the playground
            <ArrowRightIcon strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}
