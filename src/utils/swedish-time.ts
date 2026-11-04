const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  fractionalSecondDigits: 3, hourCycle: "h23", timeZoneName: "longOffset",
});

export function swedishTime(date: Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}${parts.timeZoneName!.replace("GMT", "")}`;
}
