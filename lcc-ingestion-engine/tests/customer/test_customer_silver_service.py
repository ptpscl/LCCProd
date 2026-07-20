import unittest
from unittest.mock import MagicMock, patch
import sys

supabase_service = MagicMock()
sys.modules.setdefault("app.services.customer.supabase_service", supabase_service)
sys.modules.setdefault("psycopg", MagicMock())

from app.services.customer import silver_service  # noqa: E402


class CustomerSilverServiceTests(unittest.TestCase):
    @patch.object(silver_service, "get_client")
    def test_process_run_calls_server_side_processor_and_completes(self, get_client):
        client = MagicMock()
        get_client.return_value = client
        client.table.return_value.select.return_value.execute.return_value.count = 10
        connection = MagicMock()
        cursor = MagicMock()
        silver_service.psycopg.connect.return_value.__enter__.return_value = connection
        connection.cursor.return_value.__enter__.return_value = cursor
        cursor.fetchone.return_value = (10, 7, 3)

        with patch.object(silver_service, "DATABASE_URL", "postgresql://test"):
            silver_service.process_silver_run("run-1")

        silver_service.psycopg.connect.assert_called_once()
        cursor.execute.assert_called_once_with(
            "SELECT * FROM public.refresh_customer_silver()"
        )
        update_payloads = [
            call.args[0]
            for call in client.table.return_value.update.call_args_list
        ]
        self.assertEqual(update_payloads[0]["status"], "processing")
        self.assertEqual(update_payloads[-1]["status"], "completed")
        self.assertEqual(update_payloads[-1]["processed_row_count"], 10)

    @patch.object(silver_service, "get_client")
    def test_process_run_records_failure(self, get_client):
        client = MagicMock()
        get_client.return_value = client
        client.table.return_value.select.return_value.execute.return_value.count = 10
        silver_service.psycopg.connect.side_effect = RuntimeError("processor failed")

        with patch.object(silver_service, "DATABASE_URL", "postgresql://test"):
            silver_service.process_silver_run("run-2")

        final_payload = client.table.return_value.update.call_args_list[-1].args[0]
        self.assertEqual(final_payload["status"], "failed")
        self.assertIn("processor failed", final_payload["error_message"])


if __name__ == "__main__":
    unittest.main()
