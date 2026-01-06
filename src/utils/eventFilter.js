// Utility to check if event's end date is in the future
export function isEventActive(endDate) {
  if (!endDate) return true;
  const now = new Date();
  const eventEnd = new Date(endDate.replace(" ", "T"));
  return eventEnd >= now;
}
