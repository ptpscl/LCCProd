import sys
import json
from datetime import datetime

# ==========================================
# DATASET: CUSTOMER DATABASE
# PURPOSE: BRONZE SCHEMA & DATA TYPE CHECK
# OWNER: LEONARD
# ==========================================

def validate_schema(row):
    if 'birthday' not in row:
        return "Missing column: birthday"
    try:
        datetime.strptime(row.get('birthday', ''), '%Y-%m-%d')
    except ValueError:
        return "Type error: birthday not in YYYY-MM-DD format"
    return None

def process_dataset(data):
    invalid_rows = []
    for row in data:
        error = validate_schema(row)
        if error:
            invalid_rows.append({"row": row, "error": error})
            
    if invalid_rows:
        print(json.dumps({
            "status": "failed_schema_check",
            "errors": invalid_rows[:5]
        }))
    else:
        print(json.dumps({
            "status": "success",
            "processed": len(data)
        }))

if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if raw_input:
            raw_data = json.loads(raw_input)
            process_dataset(raw_data)
        else:
            print(json.dumps({"error": "No data provided"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
