package com.noah.portal;

import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class NationalId {
    private static final Pattern FORMAT = Pattern.compile("[A-Z][12][0-9]{8}");
    // The letter values follow the Ministry of the Interior checksum table, in A–Z order.
    private static final int[] LETTER_VALUES = {
        10, 11, 12, 13, 14, 15, 16, 17, 34, 18, 19, 20, 21,
        22, 35, 23, 24, 25, 26, 27, 28, 29, 32, 30, 31, 33
    };

    private NationalId() {}

    static String username(String value) {
        String id = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        if (!FORMAT.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        int letter = LETTER_VALUES[id.charAt(0) - 'A'];
        int sum = letter / 10 + (letter % 10) * 9 + (id.charAt(9) - '0');
        for (int i = 1; i <= 8; i++) sum += (id.charAt(i) - '0') * (9 - i);
        if (sum % 10 != 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return id.toLowerCase(Locale.ROOT);
    }
}
