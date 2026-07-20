import unittest
from unittest.mock import MagicMock, patch
import sys

supabase_service = MagicMock()
sys.modules.setdefault("app.services.customer.supabase_service", supabase_service)

from app.services.customer import silver_service  # noqa: E402


class CustomerSilverServiceTests(unittest.TestCase):
    @patch.object(silver_service, "get_client")
    def test_process_run_calls_server_side_processor_and_completes(self, get_client):
        client = MagicMock()
        get_client.return_value = client
        client.table.return_value.select.return_value.execute.return_value.count = 10
        client.rpc.return_value.execute.return_value.data = [{
            "processed_row_count": 10,
            "clean_row_count": 7,
            "flagged_row_count": 3,
        }]

        silver_service.process_silver_run("run-1")

        client.rpc.assert_called_once_with("refresh_customer_silver")
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
        client.rpc.return_value.execute.side_effect = RuntimeError("processor failed")

        silver_service.process_silver_run("run-2")

        final_payload = client.table.return_value.update.call_args_list[-1].args[0]
        self.assertEqual(final_payload["status"], "failed")
        self.assertIn("processor failed", final_payload["error_message"])


if __name__ == "__main__":
    unittest.main()
