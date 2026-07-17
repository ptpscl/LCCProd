import json
import re
import sys
from datetime import date, datetime
from typing import Any


CUSTOMER_COLUMNS = (
    "CUSTOMER_NUMBER",
    "GENDER",
    "BIRTHDAY",
    "AGE",
    "CITY",
    "PROVINCE",
    "EXPIRY_DATE",
    "MEMBER_LOCATION",
    "APPLICATION_DATE",
    "MEMBER_SINCE",
    "LAST_VISIT",
    "FREQUENCY_OF_VISIT",
    "LAST_VISITED_STORE",
)

DATE_COLUMNS = ("BIRTHDAY", "EXPIRY_DATE", "APPLICATION_DATE", "MEMBER_SINCE", "LAST_VISIT")
INTEGER_COLUMNS = ("AGE", "FREQUENCY_OF_VISIT")
DATE_FORMATS = ("%Y%m%d", "%Y-%m-%d")
MISSING_VALUES = ("", "-", "NAN", "<NA>")


def is_missing(value: Any) -> bool:
    return value is None or str(value).strip().upper() in MISSING_VALUES


def parse_date(value: Any) -> date | None:
    if is_missing(value):
        return None
    text = str(value).strip()
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    raise ValueError("must use YYYYMMDD (or YYYY-MM-DD)")


def parse_non_negative_integer(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    text = str(value).strip()
    if not re.fullmatch(r"[+-]?\d+", text):
        raise ValueError("must be a whole number")
    parsed = int(text)
    if parsed < 0:
        raise ValueError("must not be negative")
    return parsed


def validate_record(record: Any, duplicate_customer_numbers: set[str]) -> list[str]:
    if not isinstance(record, dict):
        return ["Record must be a JSON object"]

    reasons: list[str] = []
    customer_number = record.get("CUSTOMER_NUMBER")
    normalized_customer_number = "" if is_missing(customer_number) else str(customer_number).strip().upper()
    if not normalized_customer_number:
        reasons.append("MISSING_CUSTOMER_NUMBER")
    elif normalized_customer_number in duplicate_customer_numbers:
        reasons.append("DUPLICATE_CUSTOMER_NUMBER")

    if is_missing(record.get("PROVINCE")):
        reasons.append("WITHOUT_PROVINCE")

    birthday = None
    birthday_value = record.get("BIRTHDAY")
    try:
        birthday = parse_date(birthday_value)
    except ValueError:
        reasons.append("BIRTHDAY_INVALID")

    if birthday:
        today = date.today()
        calculated_age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
        if birthday > today:
            reasons.append("BIRTHDAY_IN_FUTURE")
        elif calculated_age > 120:
            reasons.append("BIRTHDAY_AGE_OVER_120")
        try:
            recorded_age = parse_non_negative_integer(record.get("AGE"))
            if recorded_age is not None and abs(recorded_age - calculated_age) > 2:
                reasons.append("BIRTHDAY_AGE_MISMATCH")
        except ValueError:
            pass

    return reasons


def validate_dataset(data: Any) -> dict[str, Any]:
    if not isinstance(data, list):
        raise ValueError("data must be an array of customer records")

    customer_number_counts: dict[str, int] = {}
    for row in data:
        if not isinstance(row, dict) or is_missing(row.get("CUSTOMER_NUMBER")):
            continue
        normalized = str(row["CUSTOMER_NUMBER"]).strip().upper()
        customer_number_counts[normalized] = customer_number_counts.get(normalized, 0) + 1
    duplicate_customer_numbers = {
        number for number, count in customer_number_counts.items() if count > 1
    }

    results = []
    for index, row in enumerate(data):
        reasons = validate_record(row, duplicate_customer_numbers)
        anomaly_class = "1B" if any(reason != "WITHOUT_PROVINCE" for reason in reasons) else "1A" if reasons else "0"
        enriched_row = dict(row) if isinstance(row, dict) else {"raw_value": row}
        enriched_row["Has_Anomaly_Or_Not"] = anomaly_class
        enriched_row["Anomaly_Flags"] = "|".join(reasons)
        results.append({
            "row": index + 1,
            "raw_data": enriched_row,
            "status": "unresolved" if reasons else "clean",
            "anomaly_reason": "|".join(reasons) if reasons else None,
        })

    return {
        "status": "success",
        "processed": len(results),
        "anomalies": sum(result["status"] == "unresolved" for result in results),
        "columns": [*CUSTOMER_COLUMNS, "Has_Anomaly_Or_Not", "Anomaly_Flags"],
        "data": results,
    }


def main() -> int:
    try:
        raw_input = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
        if not raw_input.strip():
            raise ValueError("No data provided")
        print(json.dumps(validate_dataset(json.loads(raw_input))))
        return 0
    except (json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"status": "error", "error": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
