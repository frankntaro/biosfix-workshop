/** BIOSFIX circular logo — file lives in `public/biosfix-logo.png`. */
export default function BrandLogo({ className = "h-14 w-14" }) {
  return (
    <img
      src="/biosfix-logo.png"
      alt="BIOSFIX Technology"
      decoding="async"
      className={`rounded-full object-cover ${className}`.trim()}
    />
  );
}
