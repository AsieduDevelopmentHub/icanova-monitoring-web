type BrandLogoProps = {
  /** Transparent emblem (bars + rings). */
  variant?: "mark" | "lockup" | "wordmark" | "wordmarkDark";
  className?: string;
  alt?: string;
};

type BrandWordmarkProps = {
  /** Dark charcoal for light surfaces; light cream for dark surfaces. */
  tone?: "dark" | "light";
  className?: string;
  alt?: string;
};

const SRC = {
  mark: "/brand/logo-mark.png",
  lockup: "/brand/logo-lockup-light.png",
  wordmark: "/brand/logo-wordmark.png",
  wordmarkDark: "/brand/logo-wordmark-dark.png",
} as const;

/** Approved iCaNova logo assets from the brand sheet. */
export function BrandLogo({ variant = "mark", className, alt = "" }: BrandLogoProps) {
  return (
    <img
      className={className}
      src={SRC[variant]}
      alt={alt}
      decoding="async"
      draggable={false}
    />
  );
}

/** Inline brand wordmark for titles that would otherwise show raw “iCaNova”. */
export function BrandWordmark({ tone = "dark", className, alt = "iCaNova" }: BrandWordmarkProps) {
  return (
    <BrandLogo
      variant={tone === "light" ? "wordmark" : "wordmarkDark"}
      className={["mkt-inline-wordmark", className].filter(Boolean).join(" ")}
      alt={alt}
    />
  );
}
