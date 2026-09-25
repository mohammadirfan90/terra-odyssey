"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

export function AgentationWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_ENABLE_AGENTATION === "true");

  if (!isLocal) {
    return null;
  }

  const endpoint =
    process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || "http://localhost:4747";

  return <Agentation appName="Terra Odyssey" endpoint={endpoint} />;
}

