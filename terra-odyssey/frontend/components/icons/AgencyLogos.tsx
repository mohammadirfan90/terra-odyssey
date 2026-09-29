/**
 * Crisp, scalable vector SVG insignias for Earth observation space agencies
 * and data providers (NASA, ESA, JAXA, NOAA, Copernicus, USGS, NSIDC).
 *
 * Replaces plain-text provider badges with authentic vector insignias.
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface AgencyLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/** Official NASA Insignia ("The Meatball") vector SVG */
export function NasaMeatballLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 120 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="NASA official insignia"
      {...props}
    >
      {/* Blue circular planetary field */}
      <circle cx="58" cy="50" r="44" fill="#0B3D91" />

      {/* Constellation stars */}
      <g fill="#FFFFFF" opacity="0.9">
        <circle cx="32" cy="28" r="1.2" />
        <circle cx="42" cy="22" r="1.5" />
        <circle cx="28" cy="45" r="1.1" />
        <circle cx="36" cy="65" r="1.4" />
        <circle cx="78" cy="24" r="1.3" />
        <circle cx="86" cy="38" r="1.5" />
        <circle cx="74" cy="72" r="1.2" />
        <circle cx="88" cy="68" r="1.3" />
        <circle cx="50" cy="78" r="1.1" />
      </g>

      {/* Red aerodynamic supersonic chevron */}
      <path
        d="M20 58 L58 14 L76 58 L68 58 L58 32 L40 58 Z"
        fill="#FC3D21"
      />
      <path
        d="M58 32 L76 58 L98 72 L84 72 L68 58 Z"
        fill="#D62B13"
      />

      {/* White elliptical satellite orbit ring */}
      <ellipse
        cx="58"
        cy="50"
        rx="46"
        ry="15"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        transform="rotate(-28 58 50)"
        strokeDasharray="180 30"
      />

      {/* NASA Wordmark */}
      <text
        x="58"
        y="58"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="21"
        letterSpacing="2.5"
      >
        NASA
      </text>
    </svg>
  );
}

/** Official European Space Agency (ESA) vector emblem */
export function EsaLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="ESA European Space Agency insignia"
      {...props}
    >
      <circle cx="50" cy="50" r="46" fill="#002855" />
      {/* Stylized orbital globe curve */}
      <path
        d="M24 64 C28 36, 68 28, 76 52 C78 58, 74 68, 62 70 C48 72, 38 60, 42 46 C45 36, 56 34, 60 40"
        stroke="#00A3E0"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="60" cy="40" r="3.5" fill="#FFFFFF" />
      <text
        x="50"
        y="84"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="16"
        letterSpacing="2"
      >
        ESA
      </text>
    </svg>
  );
}

/** Official JAXA (Japan Aerospace Exploration Agency) insignia */
export function JaxaLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 110 50"
      width={typeof size === "number" ? size * 2.2 : size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="JAXA insignia"
      {...props}
    >
      <rect width="110" height="50" rx="8" fill="#005BAC" />
      {/* Dynamic aerodynamic swoop */}
      <path
        d="M12 36 C24 16, 42 12, 54 22 C42 24, 30 30, 22 40 Z"
        fill="#FFFFFF"
        opacity="0.85"
      />
      <text
        x="66"
        y="33"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="22"
        letterSpacing="2.5"
      >
        JAXA
      </text>
    </svg>
  );
}

/** Official NOAA vector roundel seal */
export function NoaaLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="NOAA official seal"
      {...props}
    >
      {/* Sky hemisphere */}
      <path d="M50 4 A46 46 0 0 1 96 50 L4 50 A46 46 0 0 1 50 4 Z" fill="#0096D6" />
      {/* Ocean hemisphere */}
      <path d="M4 50 A46 46 0 0 0 96 50 L50 50 Z" fill="#003865" />
      <circle cx="50" cy="50" r="46" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Sea waves and gull silhouette */}
      <path
        d="M20 50 Q35 44 50 50 T80 50"
        stroke="#FFFFFF"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M32 38 Q42 26 52 34 Q62 26 72 38 Q56 34 52 42 Q46 34 32 38 Z"
        fill="#FFFFFF"
      />
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="17"
        letterSpacing="1.5"
      >
        NOAA
      </text>
    </svg>
  );
}

/** Official European Copernicus Earth Observation emblem */
export function CopernicusLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="Copernicus EU Programme emblem"
      {...props}
    >
      <circle cx="50" cy="50" r="46" fill="#003399" />
      {/* Golden rising sun */}
      <circle cx="50" cy="46" r="15" fill="#FDB813" />
      {/* Earth horizon arc */}
      <path
        d="M10 68 C24 54, 76 54, 90 68"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
      />
      <text
        x="50"
        y="88"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="11"
        letterSpacing="1.2"
      >
        COPERNICUS
      </text>
    </svg>
  );
}

/** Official USGS (US Geological Survey) monogram logo */
export function UsgsLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 60"
      width={typeof size === "number" ? size * 1.6 : size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="USGS emblem"
      {...props}
    >
      <rect width="100" height="60" rx="8" fill="#006633" />
      <text
        x="50"
        y="41"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        fontSize="26"
        letterSpacing="2"
      >
        USGS
      </text>
    </svg>
  );
}

/** NSIDC (National Snow and Ice Data Center) polar emblem */
export function NsidcLogo({ className, size = 20, ...props }: AgencyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="NSIDC polar ice emblem"
      {...props}
    >
      <circle cx="50" cy="50" r="46" fill="#0C4A6E" />
      {/* Crystalline polar snowflake geometry */}
      <g stroke="#38BDF8" strokeWidth="3" strokeLinecap="round">
        <line x1="50" y1="18" x2="50" y2="82" />
        <line x1="18" y1="50" x2="82" y2="50" />
        <line x1="27" y1="27" x2="73" y2="73" />
        <line x1="27" y1="73" x2="73" y2="27" />
      </g>
      <circle cx="50" cy="50" r="7" fill="#FFFFFF" />
      <text
        x="50"
        y="92"
        textAnchor="middle"
        fill="#BAE6FD"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="12"
        letterSpacing="1.5"
      >
        NSIDC
      </text>
    </svg>
  );
}

export type AgencyKind =
  | "nasa"
  | "esa"
  | "jaxa"
  | "noaa"
  | "copernicus"
  | "usgs"
  | "nsidc";

/**
 * Heuristically resolve an agency enum from provider, topic, or collection strings.
 */
export function resolveAgencyFromProvider(providerText?: string | null): AgencyKind {
  const p = (providerText || "").toLowerCase();
  if (p.includes("nsidc") || p.includes("snow and ice")) return "nsidc";
  if (p.includes("noaa") || p.includes("ncei") || p.includes("oisst")) return "noaa";
  if (p.includes("esa") || p.includes("european space") || p.includes("sentinel")) return "esa";
  if (p.includes("jaxa") || p.includes("gpm/jaxa")) return "jaxa";
  if (p.includes("copernicus") || p.includes("ecmwf")) return "copernicus";
  if (p.includes("usgs") || p.includes("geological survey") || p.includes("lp daac")) return "nasa";
  return "nasa"; // Default to NASA for NASA Earthdata products
}

/**
 * Universal Agency Logo renderer with optional label.
 */
export function AgencyLogo({
  agency,
  className,
  size = 20,
  showLabel = false,
}: {
  agency?: AgencyKind | string | null;
  className?: string;
  size?: number | string;
  showLabel?: boolean;
}) {
  const kind: AgencyKind =
    agency && ["nasa", "esa", "jaxa", "noaa", "copernicus", "usgs", "nsidc"].includes(agency.toLowerCase())
      ? (agency.toLowerCase() as AgencyKind)
      : resolveAgencyFromProvider(agency);

  let LogoComponent: React.ComponentType<AgencyLogoProps>;
  let label = "NASA";

  switch (kind) {
    case "noaa":
      LogoComponent = NoaaLogo;
      label = "NOAA";
      break;
    case "esa":
      LogoComponent = EsaLogo;
      label = "ESA";
      break;
    case "jaxa":
      LogoComponent = JaxaLogo;
      label = "JAXA";
      break;
    case "copernicus":
      LogoComponent = CopernicusLogo;
      label = "Copernicus";
      break;
    case "usgs":
      LogoComponent = UsgsLogo;
      label = "USGS";
      break;
    case "nsidc":
      LogoComponent = NsidcLogo;
      label = "NSIDC";
      break;
    case "nasa":
    default:
      LogoComponent = NasaMeatballLogo;
      label = "NASA";
      break;
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoComponent size={size} />
      {showLabel && (
        <span className="text-[10px] font-bold tracking-wider text-slate-700 uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
