function formatDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getIsoWeekNumber(dateObj) {
    const date = new Date(dateObj);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - day);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function timeToMinutes(timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number);
    return (hour * 60) + minute;
}

function normalizeTimeToAxisMinute(timeStr) {
    const raw = timeToMinutes(timeStr);
    return raw < DAY_AXIS_START_MINUTES ? raw + (24 * 60) : raw;
}

function getNormalizedBlockRange(block) {
    const start = normalizeTimeToAxisMinute(block.start);
    let end = normalizeTimeToAxisMinute(block.end);
    if (end <= start) end += 24 * 60;

    const clampedStart = Math.max(DAY_AXIS_START_MINUTES, Math.min(start, DAY_AXIS_END_MINUTES));
    const clampedEnd = Math.max(DAY_AXIS_START_MINUTES, Math.min(end, DAY_AXIS_END_MINUTES));
    if (clampedEnd <= clampedStart) return null;

    return { start: clampedStart, end: clampedEnd };
}

function getBusinessDateInfo(dateObj) {
    const d = new Date(dateObj);
    const rawMinutes = (d.getHours() * 60) + d.getMinutes();
    const businessDate = new Date(d);
    const axisMinute = rawMinutes < DAY_AXIS_START_MINUTES ? rawMinutes + (24 * 60) : rawMinutes;
    if (rawMinutes < DAY_AXIS_START_MINUTES) {
        businessDate.setDate(businessDate.getDate() - 1);
    }

    return {
        dateStr: formatDateStr(businessDate),
        axisMinute
    };
}

function getBlockTypeByScore(durationHours, flexibility) {
    const score = durationHours * flexibility;
    if (score === 0) return 'fish';
    if (score >= 2.0) return 'meat';
    if (score >= 1.4) return 'fruit';
    return 'veggie';
}

function getFlexibilityByAnswers(canTakeNotes, canIsolate) {
    if (canTakeNotes && canIsolate) return 1.0;
    if (canTakeNotes && !canIsolate) return 0.7;
    if (!canTakeNotes && canIsolate) return 0.4;
    return 0;
}

function formatDurationHours(durationHours) {
    if (Number.isInteger(durationHours)) return `${durationHours}h`;
    return `${durationHours.toFixed(1)}h`;
}

function truncateTextByChars(text, maxChars) {
    const chars = Array.from(String(text || ''));
    if (chars.length <= maxChars) return chars.join('');
    return `${chars.slice(0, maxChars).join('')}...`;
}

function getRepeatDates(baseDateStr, repeatMode) {
    if (repeatMode === 'none') return [baseDateStr];

    const startDate = new Date(baseDateStr + 'T00:00:00');
    const year = startDate.getFullYear();
    const endDate = new Date(year, 11, 31);
    const dates = [];

    for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (repeatMode === 'daily') {
            dates.push(formatDateStr(d));
        } else if (repeatMode === 'workdays') {
            if (day >= 1 && day <= 5) dates.push(formatDateStr(d));
        } else if (repeatMode === 'weekly') {
            if (d.getDay() === startDate.getDay()) dates.push(formatDateStr(d));
        }
    }

    return dates;
}
