// Shared logic for resolving whether a ministry group member is available on a
// given date, combining their weekly recurring pattern with date-specific
// exceptions (e.g. vacation blackout dates). Exceptions always win over the
// weekly pattern; with no rule at all, a member defaults to available.

/**
 * @param {Object} params
 * @param {string} params.memberEmail
 * @param {string} params.date - 'yyyy-MM-dd'
 * @param {Array} params.weeklyRules - rows from member_weekly_availability
 * @param {Array} params.exceptions - rows from member_availability_exceptions
 * @returns {{ available: boolean, reason: string|null, source: 'exception'|'weekly'|'default' }}
 */
export function getMemberAvailability({ memberEmail, date, weeklyRules = [], exceptions = [] }) {
  if (!memberEmail || !date) return { available: true, reason: null, source: 'default' };

  const exception = exceptions.find(e =>
    e.member_email === memberEmail && e.start_date <= date && e.end_date >= date
  );
  if (exception) {
    return { available: exception.is_available !== false, reason: exception.reason || null, source: 'exception' };
  }

  const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0 = Sunday .. 6 = Saturday
  const weeklyRule = weeklyRules.find(r => r.member_email === memberEmail && r.day_of_week === dayOfWeek);
  if (weeklyRule) {
    return { available: weeklyRule.is_available !== false, reason: null, source: 'weekly' };
  }

  return { available: true, reason: null, source: 'default' };
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];
