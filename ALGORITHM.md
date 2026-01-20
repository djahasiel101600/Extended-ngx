Purpose

- Convert CSV date-range rows into a computed `days_difference` value using a business rule that excludes a limited grace period after the start date.
- Provide informative metadata for each row (leading excluded dates, weekends, holidays, notes).

Inputs
- `start_date` and `end_date` are customizable depending on available columns
- `start_date`and `end_date` strings in `YYYY-MM-DD` format.
- Optional holiday set (dates mapped to descriptions).

High-level rules

1. Parse and validate dates (format: `YYYY-MM-DD`). Invalid formats can be auto-corrected or corrected interactively.
2. The algorithm applies a fixed 24-hour grace period starting at the `start_date`.
   - Each weekday immediately following the start contributes 12 hours toward this 24h grace.
   - Weekends and holidays contribute 0 hours toward the grace but are excluded automatically if they appear contiguously after the start.
3. Exclusion window begins at the `start_date` itself (the start day can be excluded as part of the contiguous leading block if it is treated under the rule), and extends forward over contiguous days while:
   - a day is a weekend or holiday (always excluded, consumes 0 grace hours), or
   - a weekday occurs while remaining grace hours > 0 (consumes 12h per weekday).
     When grace hours reach 0 (or below) on a weekday, exclusion stops and counting begins on the next calendar day.
4. After building the contiguous leading exclusion block, the `days_difference` is the inclusive calendar span (end - start + 1) minus the length of the excluded leading block.
5. If `end_date < start_date` the code may prompt to correct order; if user chooses to keep the negative interval the code computes the adjusted count for the reversed interval and negates the result.
6. Holidays are used both to determine exclusion (they act like weekends for contiguous-leading detection) and to populate metadata (which holiday dates lie inside the inclusive interval).

Important behavioral details

- Only the contiguous block immediately starting from `start_date` is excluded. Non-contiguous weekends/holidays inside the date range are NOT removed from the count (they are reported in metadata, but are not subtracted).
- The counting base is calendar days (not weekdays only). After exclusions, all remaining calendar days between the adjusted bounds are counted (per spec).
- If `start_date == end_date`, result is `0` (grace covers the single day).

Examples

- Example A
  - start = 2026-01-12 (Monday), end = 2026-01-15 (Thursday)
  - Inclusive days: 12,13,14,15 => 4 days
  - Exclusion: Start day + following contiguous days that consume the 24h grace.
    - Day 12 (Mon) contributes 12h (grace left 12h), excluded
    - Day 13 (Tue) contributes 12h (grace reaches 0), excluded
    - Grace exhausted — stop excluding further weekdays; day 14 is counted
  - days_difference = 4 − 2 = 2 (days 14 and 15)

- Example B
  - start = 2026-01-15 (Thu), end = 2026-01-19 (Mon)
  - Sequence: 15(Thu - weekday), 16(Fri - weekday), 17(Sat - weekend), 18(Sun - weekend), 19(Mon)
  - Exclusion:
    - Day 15 contributes 12h (grace left 12h) -> excluded
    - Day 16 contributes 12h (grace reaches 0) -> excluded
    - After weekdays exhausted, contiguous weekend days 17 & 18 are excluded automatically (weekend/holiday exclusion continues)
    - Next calendar day 19 is the first counted day
  - days_difference = 1 (only day 19)

Pseudocode (core function)

```
function adjusted_inclusive_days_excluding_leading_nonwork(start, end, holidays):
    if start > end: swap(start, end)
    if start == end: return 0, []

    total = (end - start).days + 1
    leading = []
    grace_hours = 24
    weekday_hours = 12
    allow_weekday_exclusion = True
    d = start

    while d <= end:
        if d is weekend or d in holidays:
            leading.append(d)
            d = d + 1 day
            continue

        if allow_weekday_exclusion and grace_hours > 0:
            leading.append(d)
            grace_hours -= weekday_hours
            d = d + 1 day
            if grace_hours <= 0:
                allow_weekday_exclusion = False
            continue

        break

    adjusted = total - len(leading)
    return adjusted, leading
```

Edge cases and notes

- Holidays: pass a dictionary of dates to the processing functions. Holidays are treated as non-working for leading exclusion and reported in metadata.
- Interactive corrections: The CSV reader and processing flow include interactive helpers to suggest and accept corrected date strings — these are used only when `interactive` mode is enabled.
- Negative ranges: if the end date is before start date and the user elects to keep them, the function computes the adjusted count on the reversed interval and returns a negative value so consumers can see the sign.
