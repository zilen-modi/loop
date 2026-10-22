"use client";

import { useEffect, useState } from "react";

/** True after hydration; use it for anything that depends on localStorage or the clock. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(true);
  }, []);
  return m;
}
