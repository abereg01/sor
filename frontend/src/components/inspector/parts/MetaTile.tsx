import React from "react";

export function metaTile(label: string, value: React.ReactNode, valueClassName?: string) {
  const cls = valueClassName ? `meta-tile-value ${valueClassName}` : "meta-tile-value";
  return (
    <div className="meta-tile">
      <div className="meta-tile-label">{label}</div>
      <div className={`${cls} meta-tile-value-text`}>
        {value}
      </div>
    </div>
  );
}
