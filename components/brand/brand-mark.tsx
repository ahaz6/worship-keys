import Image from "next/image";

/**
 * The shared Worship Suite brand anchor: round product logo plus the two-line
 * wordmark. Sized per Design-Art.md 3.1 and never distorted.
 */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <div className="brand">
      <Image
        className="brand-logo"
        src="/worship-keys-icon.png"
        alt="Worship Keys"
        width={size}
        height={size}
        style={{ width: size, height: size, flexBasis: size }}
        priority
      />
      <span className="brand-copy">
        <b>Worship</b>
        <strong>Keys</strong>
      </span>
    </div>
  );
}
