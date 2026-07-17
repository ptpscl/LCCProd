import sys
import json
from datetime import datetime

# ==========================================
# DATASET: CUSTOMER DATABASE
# PURPOSE: SILVER ANOMALY DETECTION
# OWNER: LEONARD
# ==========================================

def flag_impossible_birthdays(record):
    try:
        bday = datetime.strptime(record.get('birthday', ''), '%Y-%m-%d')
        age = (datetime.now() - bday).days / 365
        if age < 0:
            return "Future Date Flag"
        if age > 120:
            return "Impossible Age Flag"
        return None
    except ValueError:
        return "Invalid Date Format"

def validate_dataset(data):
    results = []
    for row in data:
        anomaly = flag_impossible_birthdays(row)
        results.append({
            "raw_data": row,
            "status": "unresolved" if anomaly else "clean",
            "anomaly_reason": anomaly
        })
        
    print(json.dumps({
        "status": "success",
        "processed": len(results),
        "anomalies": sum(1 for r in results if r["status"] == "unresolved"),
        "data": results
    }))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        raw_data = json.loads(sys.argv[1])
        validate_dataset(raw_data)
    else:
        print(json.dumps({"error": "No data provided"}))
