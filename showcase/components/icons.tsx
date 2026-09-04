// One drawn icon set — consistent 1.6 stroke, 24px grid, currentColor.
// No emoji/unicode stand-ins anywhere in the UI.

type P = { size?: number; className?: string; strokeWidth?: number };

function svg(children: React.ReactNode, size = 18, sw = 1.6, className?: string) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Menu = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>,
    size ?? 20,
    strokeWidth,
    className,
  );

export const Chevron = ({ size, className, strokeWidth }: P) =>
  svg(<path d="M6 9l6 6 6-6" />, size ?? 16, strokeWidth, className);

export const ArrowRight = ({ size, className, strokeWidth }: P) =>
  svg(<path d="M5 12h14M13 6l6 6-6 6" />, size ?? 18, strokeWidth, className);

export const ArrowLeft = ({ size, className, strokeWidth }: P) =>
  svg(<path d="M19 12H5M11 6l-6 6 6 6" />, size ?? 18, strokeWidth, className);

export const External = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
    </>,
    size ?? 16,
    strokeWidth,
    className,
  );

export const GitHub = ({ size, className }: P) => (
  <svg
    width={size ?? 18}
    height={size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
  </svg>
);

export const Play = ({ size, className }: P) => (
  <svg
    width={size ?? 22}
    height={size ?? 22}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.5-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
  </svg>
);

export const Spark = ({ size, className }: P) => (
  <svg
    width={size ?? 14}
    height={size ?? 14}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2l2.2 6.4L21 10l-5.4 2.4L12 22l-2.2-6.4L4 13l5.4-2.4L12 2z" />
  </svg>
);

export const Copy = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>,
    size ?? 15,
    strokeWidth,
    className,
  );

export const Check = ({ size, className, strokeWidth }: P) =>
  svg(<path d="M4 12l5 5L20 6" />, size ?? 15, strokeWidth ?? 2, className);

// category glyphs (rendered white-on-color inside a rounded square)
export const Bolt = ({ size, className }: P) => (
  <svg width={size ?? 13} height={size ?? 13} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);
export const Grid = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>,
    size ?? 13,
    strokeWidth ?? 1.8,
    className,
  );
export const Link = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M9 15l6-6" />
      <path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" />
      <path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" />
    </>,
    size ?? 13,
    strokeWidth ?? 1.8,
    className,
  );
export const Layers = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M12 3l8.5 4.5L12 12 3.5 7.5 12 3z" />
      <path d="M3.5 12L12 16.5 20.5 12" />
      <path d="M3.5 16.5L12 21l8.5-4.5" />
    </>,
    size ?? 13,
    strokeWidth ?? 1.7,
    className,
  );
export const Plug = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M9 2v5M15 2v5" />
      <path d="M7 7h10v3a5 5 0 0 1-10 0V7z" />
      <path d="M12 15v7" />
    </>,
    size ?? 13,
    strokeWidth ?? 1.7,
    className,
  );
export const Discord = ({ size, className }: P) => (
  <svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.27 5.33A16.6 16.6 0 0 0 15.1 4l-.2.42a15.4 15.4 0 0 1 3.7 1.18 15.7 15.7 0 0 0-11.2 0 15.4 15.4 0 0 1 3.7-1.18L10.9 4a16.6 16.6 0 0 0-4.17 1.33C4.1 9.26 3.4 13.09 3.75 16.86a16.7 16.7 0 0 0 5.06 2.56c.4-.55.77-1.14 1.08-1.76-.6-.22-1.17-.5-1.7-.83.14-.1.28-.21.42-.32a11.95 11.95 0 0 0 10.78 0c.14.11.28.22.42.32-.54.33-1.11.6-1.71.83.31.62.68 1.21 1.08 1.76a16.6 16.6 0 0 0 5.06-2.56c.42-4.37-.72-8.16-3-11.53ZM9.68 14.5c-.99 0-1.8-.9-1.8-2.02 0-1.12.8-2.03 1.8-2.03s1.82.92 1.8 2.03c0 1.11-.81 2.02-1.8 2.02Zm6.64 0c-.99 0-1.8-.9-1.8-2.02 0-1.12.8-2.03 1.8-2.03s1.82.92 1.8 2.03c0 1.11-.8 2.02-1.8 2.02Z" />
  </svg>
);
export const Globe = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
      <path d="M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
    </>,
    size ?? 17,
    strokeWidth ?? 1.6,
    className,
  );

export const Book = ({ size, className, strokeWidth }: P) =>
  svg(
    <>
      <path d="M12 6.5C10.4 5.1 7.9 4.6 4 5.1v13c3.9-.5 6.4 0 8 1.4 1.6-1.4 4.1-1.9 8-1.4v-13c-3.9-.5-6.4 0-8 1.4z" />
      <path d="M12 6.5V19.9" />
    </>,
    size ?? 18,
    strokeWidth ?? 1.7,
    className,
  );
