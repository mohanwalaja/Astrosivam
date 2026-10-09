<?php
/** Shared explanatory copy for browser, Node and PHP Muhurtham reports. */
class MuhurthamReportNotes {
    public static function build(array $result, array $event, string $lang = 'en'): array {
        static $translations = null;
        if ($translations === null) {
            $path = __DIR__ . '/muhurtham_report_notes.json';
            $translations = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
        }
        if (!is_array($translations['en'] ?? null)) {
            // Do not corrupt / block a PDF if a partial deployment omitted the
            // translation asset. The full localized guide returns on deployment.
            error_log('Muhurtham report selection-guide translations are unavailable.');
            return [
                'title' => 'DATE SELECTION',
                'checksHeading' => 'What was checked for these dates',
                'checksText' => 'Every day of the window is judged on its Panchangam (nakshatra at local sunrise, tithi, weekday and Tamil month) and Venus/Jupiter asta periods are excluded. The selected date is checked against both charts: Chandrashtama, Tara Bala and each person\'s own Janma Nakshatra.',
                'weekdayHeading' => 'Weekday rules',
                'weekdayText' => 'Weekday exclusions follow the selected ceremony rules; family traditions may differ.',
                'selectionHeading' => 'Recommended dates', 'summaryText' => '',
                'selectionText' => 'Only BEST and GOOD dates are listed after Panchangam and ceremony-specific checks. FAIR and AVOID dates are not listed.',
                'personalMarkNote' => 'Dates marked with ♥ are especially auspicious for YOU personally — verified against your own Janma Nakshatra and Rasi (good Tara Balam, no Chandrashtama). The other listed dates are generally auspicious for everyone.'
            ];
        }
        $copy = $translations[$lang] ?? $translations['en'];
        $months = !empty($result['months']) && is_array($result['months'])
            ? $result['months']
            : array_filter([$result['prevMonth'] ?? null, $result['chosenMonth'] ?? null, $result['nextMonth'] ?? null]);
        $counts = ['total' => 0, 'recommended' => 0, 'best' => 0, 'good' => 0, 'fair' => 0, 'avoid' => 0];
        foreach ($months as $month) {
            foreach ((array) ($month['days'] ?? []) as $day) {
                $counts['total']++;
                $grade = strtolower((string) ($day['grade'] ?? ''));
                if (in_array($grade, ['best', 'good', 'fair', 'avoid'], true)) { $counts[$grade]++; }
            }
        }
        $counts['recommended'] = $counts['best'] + $counts['good'];
        $placeholders = [];
        foreach ($counts as $key => $value) { $placeholders['{' . $key . '}'] = (string) $value; }
        $weekdays = array_values(array_filter(array_map(function ($index) use ($copy) {
            return $copy['weekdays'][(int) $index] ?? '';
        }, (array) ($event['avoidWeekdays'] ?? []))));
        $monthNames = array_map(function ($key) use ($copy) {
            return $copy['monthNames'][$key] ?? $key;
        }, (array) ($event['avoidMonths'] ?? []));
        $eventKey = (string) ($result['eventKey'] ?? 'wedding');
        $selectionParts = [$copy['selectionRule']];
        if (count($monthNames)) {
            $selectionParts[] = str_replace('{months}', implode(', ', $monthNames), $copy['seasonRule']);
        }
        if (in_array($eventKey, ['wedding', 'engagement'], true) || !empty($event['requireGuruSukraClean'])) {
            $selectionParts[] = $copy['combustionRule'];
        }
        if (!empty($result['dob']) || !empty($result['persons'])) {
            $selectionParts[] = $copy['personalRule'];
        }
        // An old deployment may not contain the event catalogue. Do not claim
        // that there are no weekday restrictions when the rules are unknown.
        $weekdayText = !array_key_exists('avoidWeekdays', $event)
            ? $copy['weekdayUnknown']
            : (count($weekdays)
                ? str_replace('{weekdays}', implode(', ', $weekdays), $copy['weekdayRule'])
                : $copy['weekdayNone']);

        return [
            'title' => $copy['title'],
            // Never a heading without a body: fall back to English copy rather
            // than printing the title alone if a deployment omits the text.
            'checksHeading' => (string) ($copy['checksHeading'] ?? ($translations['en']['checksHeading'] ?? '')),
            'checksText' => (string) ($copy['checksText'] ?? ($translations['en']['checksText'] ?? '')),
            'weekdayHeading' => $copy['weekdayHeading'],
            'weekdayText' => $weekdayText,
            'selectionHeading' => $copy['selectionHeading'],
            'summaryText' => strtr($copy['summary'], $placeholders),
            'selectionText' => implode(' ', $selectionParts),
            'personalMarkNote' => (string) ($copy['personalMarkNote']
                ?? ($translations['en']['personalMarkNote'] ?? ''))
        ];
    }
}
