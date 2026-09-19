/**
 * "BOOK NOW" pill — copied from the original:
 * white sweeps in from the left, text turns purple, a tooth icon expands 0 → 24px.
 */
export function BookButton({
  href = "#contact",
  size = "lg",
  className = "",
  children = "Book Now",
}: {
  href?: string;
  size?: "lg" | "md" | "sm";
  className?: string;
  children?: React.ReactNode;
}) {
  // literal class names so Tailwind keeps them
  const sizeClass = { lg: "book-btn-lg", md: "book-btn-md", sm: "book-btn-sm" }[size];
  return (
    <a href={href} className={`book-btn ${sizeClass} ${className}`}>
      <span className="book-btn-content">
        <svg className="book-btn-tooth" viewBox="0 0 512 512" aria-hidden>
          <path d="M414.2 16c-34.9 0-66.8 17-88.7 44.5-12.7 16-24.8 35-29.5 35s-16.8-19-29.5-35C244.6 33 212.7 16 177.8 16 112.9 16 60 68.9 60 133.8c0 41.5 13.9 79.7 37.3 110.4 17.5 23 37.9 44.1 52.6 68.3 15.5 25.5 25.5 56.6 25.5 95.5 0 20.4 16.5 37 37 37s37-16.6 37-37c0-21.7 4.1-33.8 11.2-43.1 5.3-7 12.8-11.4 21.4-11.4s16.1 4.4 21.4 11.4c7.1 9.3 11.2 21.4 11.2 43.1 0 20.4 16.5 37 37 37s37-16.6 37-37c0-38.9 10-70 25.5-95.5 14.7-24.2 35.1-45.3 52.6-68.3 23.4-30.7 37.3-68.9 37.3-110.4C492 68.9 439.1 16 414.2 16z" />
        </svg>
        <span>{children}</span>
      </span>
    </a>
  );
}
