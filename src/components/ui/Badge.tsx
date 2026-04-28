import React from "react";

export function Badge(props: { children: React.ReactNode; tone?: "gray" | "green" | "yellow" | "red" | "blue" | "purple" }) {
  const tone = props.tone ?? "gray";
  const styles: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`rounded-xl px-2 py-1 text-xs font-bold ${styles[tone]}`}>{props.children}</span>;
}
