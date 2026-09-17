"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemeProvider>) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
