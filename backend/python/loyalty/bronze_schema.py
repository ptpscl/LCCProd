import sys
import json
import csv
from datetime import datetime

# ==========================================
# DATASET: LOYALTY SALES
# PURPOSE: BRONZE SCHEMA & DATA TYPE CHECK
# ==========================================

EXPECTED_COLUMNS = [
    "DATE", 
    "TRANSACTION NUMBER", 
    "REGISTER NUMBER", 
    "STORE CODE", 
    "STORE CATEGORIZATION", 
    "CUSTOMER NUMBER", 
    "SKU CODE", 
    "LOYALTY SALES", 
    "QTY SOLD"
]

def validate_schema(row):
    missing_cols = set(EXPECTED_COLUMNS) - set(row.keys())
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

def process_file(file_path):
    invalid_rows = []
    processed_count = 0
    clean_file_path = file_path + '.clean.csv'
    
    with open(file_path, 'r', encoding='utf-8') as infile:
        # Check first line for tab vs comma
        first_line = infile.readline()
        delimiter = '\t' if '\t' in first_line else ','
        infile.seek(0)
        
        reader = csv.DictReader(infile, delimiter=delimiter)
        
        with open(clean_file_path, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=EXPECTED_COLUMNS, extrasaction='ignore')
            writer.writeheader()
            
            for row in reader:
                # Strip spaces from keys
                clean_row = {k.strip() if isinstance(k, str) else k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
                error = validate_schema(clean_row)
                if error:
                    if len(invalid_rows) < 5:
                        invalid_rows.append({"row": clean_row, "error": error})
                    if len(invalid_rows) > 50: # Fail fast
                        break
                else:
                    # Clean up dates to full format if needed, but for now just pass through
                    writer.writerow(clean_row)
                    processed_count += 1
            
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
            "processed": processed_count,
            "clean_file": clean_file_path
        }))

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            process_file(file_path)
        else:
            print(json.dumps({"status": "error", "message": "No file path provided"}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
