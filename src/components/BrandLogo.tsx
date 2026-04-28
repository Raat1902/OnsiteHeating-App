import React from "react";

export function BrandLogo(props: { compact?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${props.className ?? ""}`}>
      <img
        src="/onsite-logo.png"
        alt="OnSite Heating Cooling Plumbing Electrical"
        className={props.compact ? "h-10 w-auto" : "h-14 w-auto"}
      />
      {!props.compact ? (
        <div>
          <div className="text-lg font-extrabold text-gray-900">OnSite Service Command</div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
            Heating • Cooling • Plumbing • Electrical
          </div>
        </div>
      ) : null}
    </div>
  );
}
