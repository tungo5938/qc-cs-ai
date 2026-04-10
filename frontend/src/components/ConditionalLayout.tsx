"use client";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
