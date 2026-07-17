import sys
import json

# ==========================================
# DATASET: LOYALTY SALES
# PURPOSE: SILVER ANOMALY DETECTION (Business Rules)
# ==========================================

def check_anomalies(row):
    try:
        qty = float(row.get("QTY SOLD", 0))
        if qty < 0:
            return "Negative QTY SOLD Flag"
    except:
        pass
    return None

def process_dataset(data):
    results = []
    for row in data:
        anomaly = check_anomalies(row)
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
        process_dataset(raw_data)
    else:
        print(json.dumps({"error": "No data provided"}))
