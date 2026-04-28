import React from "react";

export function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "password" | "number" | "datetime-local";
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold text-gray-800">{props.label}</div>
      <input
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        required={props.required}
        min={props.min}
        step={props.step}
      />
    </label>
  );
}
