"use client";

interface LogoProps {
  size?: "small" | "medium" | "large";
  showText?: boolean;
}

export function Logo({ size = "medium", showText = true }: LogoProps) {
  const sizes = {
    small: { icon: 28, text: 14 },
    medium: { icon: 36, text: 16 },
    large: { icon: 48, text: 20 },
  };

  const { icon, text } = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          width: icon,
          height: icon,
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        }}
      >
        <svg
          width={icon * 0.5}
          height={icon * 0.5}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 20H21"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.2786 2.87868 18.5544 2.93355 18.8118 3.04015C19.0692 3.14676 19.303 3.30301 19.5 3.5C19.697 3.69698 19.8532 3.93083 19.9598 4.18821C20.0665 4.44558 20.1213 4.72142 20.1213 5C20.1213 5.27857 20.0665 5.55442 19.9598 5.81179C19.8532 6.06916 19.697 6.30301 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <span
          style={{
            fontSize: text,
            fontWeight: 700,
            color: "#1f2937",
          }}
        >
          PostCraft
        </span>
      )}
    </div>
  );
}
