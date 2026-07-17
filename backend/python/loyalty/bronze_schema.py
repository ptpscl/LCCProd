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
        float(row.get("LOYALTY SALES", 0))
        float(row.get("QTY SOLD", 0))
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
    if len(sys.argv) > 1:
        raw_data = json.loads(sys.argv[1])
        process_dataset(raw_data)
    else:
        print(json.dumps({"status": "error", "message": "No data provided"}))
