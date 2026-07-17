import sys
import json
from datetime import datetime

# ==========================================
# DATASET: LOYALTY SALES
# PURPOSE: BRONZE SCHEMA & DATA TYPE CHECK
# ==========================================

EXPECTED_COLUMNS = {
    "DATE", 
    "TRANSACTION NUMBER", 
    "REGISTER NUMBER", 
    "STORE CODE", 
    "STORE CATEGORIZATION", 
    "CUSTOMER NUMBER", 
    "SKU CODE", 
    "LOYALTY SALES", 
    "QTY SOLD"
}

def validate_schema(row):
    missing_cols = EXPECTED_COLUMNS - set(row.keys())
    if missing_cols:
        return f"Missing columns: {', '.join(missing_cols)}"
        
    try:
        val1 = row.get("LOYALTY SALES", 0)
        val2 = row.get("QTY SOLD", 0)
        if val1 == "": val1 = 0
        if val2 == "": val2 = 0
        float(val1)
        float(val2)
    except ValueError:
        return "Type error: LOYALTY SALES or QTY SOLD are not valid numbers"
        
    try:
        date_str = str(row.get("DATE", ""))
        datetime.strptime(date_str, '%y%m%d')
    except ValueError:
        return "Type error: DATE is not in YYMMDD format"
        
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
            "message": "Dataset rejected due to schema or type errors.",
            "errors": invalid_rows[:5]
        }))
    else:
        print(json.dumps({
            "status": "success",
            "message": "Schema valid. Ready for Bronze upload.",
            "processed": len(data)
        }))

if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if raw_input:
            raw_data = json.loads(raw_input)
            process_dataset(raw_data)
        else:
            print(json.dumps({"status": "error", "message": "No data provided"}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
