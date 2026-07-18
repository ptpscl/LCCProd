import sys, os
sys.path.insert(0, os.path.abspath('lcc-ingestion-engine'))
from app.services.supabase_service import get_client
client = get_client()
print(client.table('bronze_loyalty_sales').select('*', count='exact', head=True).execute())
