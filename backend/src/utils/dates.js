// All business dates are plain "YYYY-MM-DD" strings so time zones never shift a day.
const pad = (n) => String(n).padStart(2, "0");
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toStr(new Date());
const parse = (s) => new Date(`${s}T00:00:00Z`);
const dayOfWeek = (s) => parse(s).getUTCDay();

const eachDay = (start, end) => {
  const days = [];
  const d = parse(start);
  const last = parse(end);
  while (d <= last) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
};

const monthRange = (month) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
};

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
const isValidMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// A working day is not a weekend and not a public holiday
const isWorkingDay = (dateStr, weekends, holidaySet) =>
  !weekends.includes(dayOfWeek(dateStr)) && !holidaySet.has(dateStr);

const workingDaysBetween = (start, end, weekends, holidaySet) =>
  eachDay(start, end).filter((d) => isWorkingDay(d, weekends, holidaySet));

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export { toStr, todayStr, eachDay, monthRange, isValidDate, isValidMonth, isWorkingDay, workingDaysBetween, round2 };
