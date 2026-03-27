/**
 * Format a UTC timestamp for display in IST (Asia/Kolkata).
 * Returns { exact, relative, timeOnly, dateOnly }
 */
export function formatIST(dt) {
  if (!dt) return { exact: '—', relative: '—', timeOnly: '—', dateOnly: '—' };
  const date = new Date(dt);

  const exact = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const timeOnly = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateOnly = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });

  const shortDT = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Relative time
  const now = new Date();
  const diffMs = date - now; // Future meetings should be positive
  const diffMins = Math.round(diffMs / 60000);
  
  let relative;
  if (diffMins > 0) {
    if (diffMins < 60) relative = `Starting in ${diffMins} min`;
    else relative = `Upcoming`;
  } else {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) relative = `${absMins} minutes ago`;
    else if (absMins < 1440) relative = `${Math.floor(absMins/60)} hours ago`;
    else relative = dateOnly;
  }

  return { exact, relative, timeOnly, dateOnly, shortDT };
}
