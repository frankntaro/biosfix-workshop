/** Table header cells for job device fields (brand, model, serial). */
export function JobDeviceTableHead({ thClass = "pb-2 pr-4" }) {
  return (
    <>
      <th className={thClass}>Brand</th>
      <th className={thClass}>Model</th>
      <th className={thClass}>Serial Number</th>
    </>
  );
}

/** Table body cells for job device fields. */
export function JobDeviceTableCells({ device, tdClass = "py-2 pr-4" }) {
  return (
    <>
      <td className={tdClass}>{device?.brand?.trim() || "—"}</td>
      <td className={tdClass}>{device?.model?.trim() || "—"}</td>
      <td className={tdClass}>{device?.serialNumber?.trim() || "—"}</td>
    </>
  );
}

function deviceField(value) {
  const t = value?.trim();
  return t || "—";
}

/** Brand, model, and serial in separate columns (job detail header, receipt). */
export function JobDeviceDetailGrid({ device, className = "", valueClassName = "font-medium text-slate-900 dark:text-slate-100" }) {
  return (
    <dl
      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm ${className}`.trim()}
    >
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400 font-medium">Brand</dt>
        <dd className={`mt-0.5 ${valueClassName}`}>{deviceField(device?.brand)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400 font-medium">Model</dt>
        <dd className={`mt-0.5 ${valueClassName}`}>{deviceField(device?.model)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400 font-medium">Serial Number</dt>
        <dd className={`mt-0.5 ${valueClassName}`}>{deviceField(device?.serialNumber)}</dd>
      </div>
    </dl>
  );
}

/** Compact labeled device lines for cards and list subtitles. */
export function JobDeviceSummary({ device, className = "" }) {
  if (!device?.brand && !device?.model && !device?.serialNumber) {
    return <span className={`text-slate-500 ${className}`.trim()}>—</span>;
  }
  return (
    <div className={`text-xs text-slate-600 dark:text-slate-400 space-y-0.5 ${className}`.trim()}>
      {device.brand ? (
        <p>
          <span className="text-slate-500 dark:text-slate-500">Brand:</span> {device.brand}
        </p>
      ) : null}
      {device.model ? (
        <p>
          <span className="text-slate-500 dark:text-slate-500">Model:</span> {device.model}
        </p>
      ) : null}
      {device.serialNumber ? (
        <p>
          <span className="text-slate-500 dark:text-slate-500">Serial Number:</span> {device.serialNumber}
        </p>
      ) : null}
    </div>
  );
}
