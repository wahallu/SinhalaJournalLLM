import { PlusIcon } from "lucide-react";
import type { SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

export type Logo = {
  icon: SimpleIcon;
  /** Label shown under the mark; defaults to the icon's own title. */
  name?: string;
};

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[];
};

/**
 * Bordered grid of brand marks (after the 21st.dev "logo cloud 2"), with a
 * checkerboard tint and plus marks at the inner grid corners. Two columns on
 * phones, four from md up. Marks are monochrome and take their brand colour
 * on hover.
 */
export function LogoCloud({ logos, className, ...props }: LogoCloudProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 border-x border-line md:grid-cols-4",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute -top-px left-1/2 w-screen -translate-x-1/2 border-t border-line" />

      {logos.map((logo, i) => {
        const col4 = i % 4;
        const row4 = Math.floor(i / 4);
        const col2 = i % 2;
        const row2 = Math.floor(i / 2);
        const tinted2 = (row2 + col2) % 2 === 0;
        const tinted4 = (row4 + col4) % 2 === 0;
        const lastRow4 = row4 === Math.ceil(logos.length / 4) - 1;
        const lastRow2 = row2 === Math.ceil(logos.length / 2) - 1;
        return (
          <LogoCard
            key={logo.icon.slug}
            logo={logo}
            className={cn(
              "border-line",
              col2 === 0 && "border-r",
              col4 !== 3 ? "md:border-r" : "md:border-r-0",
              !lastRow2 && "border-b",
              lastRow4 ? "md:border-b-0" : "md:border-b",
              tinted2 ? "bg-panel-bg" : "bg-page-bg",
              tinted4 ? "md:bg-panel-bg" : "md:bg-page-bg",
            )}
          >
            {/* Plus marks on inner corners: mobile grid, then desktop grid. */}
            {col2 === 0 && !lastRow2 && (
              <PlusIcon
                className="absolute -bottom-[12.5px] -right-[12.5px] z-10 size-6 text-text-muted md:hidden"
                strokeWidth={1}
              />
            )}
            {col4 !== 3 && !lastRow4 && (col4 + row4) % 2 === 0 && (
              <PlusIcon
                className="absolute -bottom-[12.5px] -right-[12.5px] z-10 hidden size-6 text-text-muted md:block"
                strokeWidth={1}
              />
            )}
          </LogoCard>
        );
      })}

      <div className="pointer-events-none absolute -bottom-px left-1/2 w-screen -translate-x-1/2 border-b border-line" />
    </div>
  );
}

type LogoCardProps = React.ComponentProps<"div"> & {
  logo: Logo;
};

function LogoCard({ logo, className, children, ...props }: LogoCardProps) {
  const name = logo.name ?? logo.icon.title;
  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 px-4 py-8 md:p-8",
        className,
      )}
      style={{ ["--brand" as string]: `#${logo.icon.hex}` }}
      {...props}
    >
      <svg
        role="img"
        aria-label={name}
        viewBox="0 0 24 24"
        className="h-7 w-7 fill-black-main transition-colors duration-300 group-hover:fill-[var(--brand)] md:h-8 md:w-8"
      >
        <path d={logo.icon.path} />
      </svg>
      <span aria-hidden="true" className="text-sm font-medium text-[#5f5c56]">
        {name}
      </span>
      {children}
    </div>
  );
}
