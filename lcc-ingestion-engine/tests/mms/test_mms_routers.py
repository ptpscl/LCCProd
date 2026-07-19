import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, call, patch


try:
    import fastapi  # noqa: F401
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    REAL_FASTAPI = True
except ModuleNotFoundError:
    REAL_FASTAPI = False
    fastapi_stub = ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:
        def __init__(self, *, prefix: str, tags: list[str]):
            self.prefix = prefix
            self.tags = tags
            self.routes = []

        def _decorator(self, method: str, path: str):
            def decorate(function):
                self.routes.append((method, path, function))
                return function

            return decorate

        def get(self, path: str):
            return self._decorator("GET", path)

        def post(self, path: str):
            return self._decorator("POST", path)

    def Query(*, default=None, **_constraints):
        return default

    fastapi_stub.APIRouter = APIRouter
    fastapi_stub.HTTPException = HTTPException
    fastapi_stub.Query = Query
    sys.modules["fastapi"] = fastapi_stub

    responses_stub = ModuleType("fastapi.responses")

    class StreamingResponse:
        def __init__(self, content, *, media_type: str, headers: dict[str, str]):
            self.body_iterator = content
            self.media_type = media_type
            self.headers = headers

    responses_stub.StreamingResponse = StreamingResponse
    sys.modules["fastapi.responses"] = responses_stub


from fastapi import HTTPException

from app.routers.mms import bronze as bronze_router
from app.routers.mms import ingest as ingest_router
from app.services.mms.ingestion_service import (
    BatchNotFoundError,
    SchemaMismatchError,
)
from app.services.mms import supabase_service


BATCH_ID = "11111111-1111-1111-1111-111111111111"


class MmsIngestRouterTests(unittest.TestCase):
    def test_router_namespace_and_tags(self):
        self.assertEqual(ingest_router.router.prefix, "/mms/ingest")
        self.assertEqual(ingest_router.router.tags, ["mms-ingest"])

    @patch.object(ingest_router, "ingest_batch")
    def test_post_preserves_ingestion_response(self, ingest_batch):
        expected = {
            "batch_id": BATCH_ID,
            "status": "ingested",
            "rows_ingested": 4,
        }
        ingest_batch.return_value = expected

        self.assertEqual(ingest_router.run_ingest(BATCH_ID), expected)
        ingest_batch.assert_called_once_with(BATCH_ID)

    @patch.object(ingest_router, "ingest_batch")
    def test_post_maps_not_found_validation_and_internal_errors(self, ingest_batch):
        cases = [
            (BatchNotFoundError("missing"), 404, "missing"),
            (SchemaMismatchError("bad MMS row"), 400, "bad MMS row"),
            (RuntimeError("password=secret"), 500, "internal service error"),
        ]
        for error, status_code, detail in cases:
            with self.subTest(status_code=status_code):
                ingest_batch.side_effect = error
                with self.assertRaises(HTTPException) as raised:
                    ingest_router.run_ingest(BATCH_ID)
                self.assertEqual(raised.exception.status_code, status_code)
                self.assertIn(detail, raised.exception.detail)
                self.assertNotIn("password=secret", raised.exception.detail)

    @patch.object(ingest_router, "ingest_batch")
    def test_post_preserves_deliberate_http_exception(self, ingest_batch):
        deliberate = HTTPException(status_code=409, detail="deliberate")
        ingest_batch.side_effect = deliberate
        with self.assertRaises(HTTPException) as raised:
            ingest_router.run_ingest(BATCH_ID)
        self.assertIs(raised.exception, deliberate)

    @patch.object(ingest_router, "get_batch")
    def test_status_response_and_errors(self, get_batch):
        get_batch.return_value = {
            "status": "ingested",
            "row_count": 10,
            "store_code": "417",
            "year_month": "2024-01",
        }
        self.assertEqual(
            ingest_router.get_ingest_status(BATCH_ID),
            {
                "batch_id": BATCH_ID,
                "status": "ingested",
                "row_count": 10,
                "store_code": "417",
                "year_month": "2024-01",
            },
        )

        get_batch.return_value = None
        with self.assertRaises(HTTPException) as missing:
            ingest_router.get_ingest_status(BATCH_ID)
        self.assertEqual(missing.exception.status_code, 404)

        get_batch.side_effect = RuntimeError("service-role-key=secret")
        with self.assertRaises(HTTPException) as failed:
            ingest_router.get_ingest_status(BATCH_ID)
        self.assertEqual(failed.exception.status_code, 500)
        self.assertNotIn("secret", failed.exception.detail)


class MmsBronzeRouterTests(unittest.TestCase):
    def setUp(self):
        if REAL_FASTAPI:
            app = FastAPI()
            app.include_router(bronze_router.router)
            self.client = TestClient(app)

    def test_router_namespace_and_tags(self):
        self.assertEqual(bronze_router.router.prefix, "/mms/bronze")
        self.assertEqual(bronze_router.router.tags, ["mms-bronze"])

    @patch.object(bronze_router, "fetch_bronze_stats")
    def test_stats_supports_empty_and_populated_results(self, fetch_stats):
        for expected in [
            {"total_rows": 0, "last_updated": None},
            {"total_rows": 25, "last_updated": "2026-07-19T00:00:00+00:00"},
        ]:
            with self.subTest(expected=expected):
                fetch_stats.return_value = expected
                self.assertEqual(bronze_router.get_bronze_stats(), expected)

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_rows_forwards_all_filters_and_pagination(self, count_rows, fetch_rows):
        count_rows.return_value = 41
        fetch_rows.return_value = [{"id": 21}]

        response = bronze_router.get_bronze_rows(
            store_code="417",
            date_from="240102",
            date_to="240131",
            sku_code="3778875",
            page=2,
            page_size=20,
        )

        filters = {
            "store_code": "417",
            "date_from": "240102",
            "date_to": "240131",
            "sku_code": "3778875",
        }
        count_rows.assert_called_once_with(**filters)
        fetch_rows.assert_called_once_with(**filters, offset=20, limit=20)
        self.assertEqual(
            response,
            {
                "rows": [{"id": 21}],
                "page": 2,
                "page_size": 20,
                "total_matching_rows": 41,
            },
        )

    def test_rows_rejects_invalid_page_and_page_size(self):
        invalid_values = [(0, 20), (1, 0), (1, 101)]
        for page, page_size in invalid_values:
            with self.subTest(page=page, page_size=page_size):
                with self.assertRaises(HTTPException) as raised:
                    bronze_router.get_bronze_rows(page=page, page_size=page_size)
                self.assertEqual(raised.exception.status_code, 400)

    def test_rows_rejects_invalid_or_reversed_dates(self):
        cases = [
            {"date_from": "20240102"},
            {"date_from": "24A102"},
            {"date_from": "240231"},
            {"date_from": "240201", "date_to": "240131"},
        ]
        for filters in cases:
            with self.subTest(filters=filters):
                with self.assertRaises(HTTPException) as raised:
                    bronze_router.get_bronze_rows(
                        **filters, page=1, page_size=20
                    )
                self.assertEqual(raised.exception.status_code, 400)

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_export_below_limit_streams_mms_csv(self, count_rows, fetch_rows):
        count_rows.return_value = 2
        fetch_rows.return_value = [
            {"DATE": "240102", "TRANSACTION_NUMBER": "1"},
            {"DATE": "240102", "TRANSACTION_NUMBER": "2"},
        ]

        if REAL_FASTAPI:
            response = self.client.get(
                "/mms/bronze/export", params={"store_code": "417"}
            )
            self.assertEqual(response.status_code, 200)
            content = response.text
            content_type = response.headers["content-type"]
            disposition = response.headers["content-disposition"]
        else:
            response = bronze_router.export_bronze_rows(store_code="417")
            content = "".join(response.body_iterator)
            content_type = response.media_type
            disposition = response.headers["Content-Disposition"]

        self.assertTrue(content_type.startswith("text/csv"))
        self.assertIn("mms_bronze_export.csv", disposition)
        self.assertIn("DATE,TRANSACTION_NUMBER", content)
        self.assertIn("240102,1", content)
        self.assertIn("240102,2", content)
        fetch_rows.assert_called_once_with(
            store_code="417",
            date_from=None,
            date_to=None,
            sku_code=None,
            offset=0,
            limit=2,
        )

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_export_allows_exactly_50000_rows(self, count_rows, fetch_rows):
        count_rows.return_value = 50_000
        fetch_rows.return_value = []

        if REAL_FASTAPI:
            response = self.client.get("/mms/bronze/export")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.headers["content-type"].startswith("text/csv"))
        else:
            response = bronze_router.export_bronze_rows()
            list(response.body_iterator)
            self.assertEqual(response.media_type, "text/csv")

        fetch_rows.assert_called_once()
        self.assertEqual(fetch_rows.call_args.kwargs["limit"], 1_000)

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_export_rejects_more_than_50000_rows(self, count_rows, fetch_rows):
        count_rows.return_value = 50_001

        with self.assertRaises(HTTPException) as raised:
            bronze_router.export_bronze_rows()

        self.assertEqual(raised.exception.status_code, 400)
        fetch_rows.assert_not_called()

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_export_database_failure_is_sanitized_500(self, count_rows, fetch_rows):
        count_rows.return_value = 1
        fetch_rows.side_effect = RuntimeError("service-role-key=secret")

        with self.assertRaises(HTTPException) as raised:
            bronze_router.export_bronze_rows()

        self.assertEqual(raised.exception.status_code, 500)
        self.assertNotIn("secret", raised.exception.detail)

    @patch.object(bronze_router, "fetch_bronze_rows")
    @patch.object(bronze_router, "count_bronze_rows")
    def test_export_retrieval_is_always_bounded_to_1000(self, count_rows, fetch_rows):
        count_rows.return_value = 2_501
        fetch_rows.side_effect = lambda **kwargs: [
            {"id": kwargs["offset"], "DATE": "240102"}
        ]

        if REAL_FASTAPI:
            response = self.client.get(
                "/mms/bronze/export",
                params={
                    "store_code": "417",
                    "date_from": "240102",
                    "date_to": "240131",
                    "sku_code": "3778875",
                },
            )
            self.assertEqual(response.status_code, 200)
        else:
            response = bronze_router.export_bronze_rows(
                store_code="417",
                date_from="240102",
                date_to="240131",
                sku_code="3778875",
            )
            list(response.body_iterator)

        self.assertEqual(fetch_rows.call_count, 3)
        self.assertEqual(
            [item.kwargs["offset"] for item in fetch_rows.call_args_list],
            [0, 1_000, 2_000],
        )
        self.assertEqual(
            [item.kwargs["limit"] for item in fetch_rows.call_args_list],
            [1_000, 1_000, 501],
        )
        self.assertTrue(
            all(item.kwargs["limit"] <= 1_000 for item in fetch_rows.call_args_list)
        )


class MmsBronzeSupabaseServiceTests(unittest.TestCase):
    @patch.object(supabase_service, "get_client")
    def test_fetch_rows_pushes_filters_order_and_range_to_supabase(self, get_client):
        client = MagicMock()
        query = MagicMock()
        response = SimpleNamespace(data=[{"id": 21}])
        client.table.return_value = query
        query.select.return_value = query
        query.eq.return_value = query
        query.gte.return_value = query
        query.lte.return_value = query
        query.order.return_value = query
        query.range.return_value = query
        query.execute.return_value = response
        get_client.return_value = client

        rows = supabase_service.fetch_bronze_rows(
            store_code="417",
            date_from="240102",
            date_to="240131",
            sku_code="3778875",
            offset=20,
            limit=20,
        )

        self.assertEqual(rows, [{"id": 21}])
        client.table.assert_called_once_with("bronze_mms")
        query.select.assert_called_once_with("*")
        self.assertEqual(
            query.eq.call_args_list,
            [call("STORE_CODE", "417"), call("SKU_CODE", "3778875")],
        )
        query.gte.assert_called_once_with("DATE", "240102")
        query.lte.assert_called_once_with("DATE", "240131")
        self.assertEqual(
            query.order.call_args_list,
            [
                call("DATE", desc=False),
                call("TRANSACTION_NUMBER", desc=False),
            ],
        )
        query.range.assert_called_once_with(20, 39)

    @patch.object(supabase_service, "get_client")
    def test_count_pushes_all_filters_without_retrieving_rows(self, get_client):
        client = MagicMock()
        query = MagicMock()
        response = SimpleNamespace(count=7)
        client.table.return_value = query
        query.select.return_value = query
        query.eq.return_value = query
        query.gte.return_value = query
        query.lte.return_value = query
        query.execute.return_value = response
        get_client.return_value = client

        count = supabase_service.count_bronze_rows(
            store_code="417",
            date_from="240102",
            date_to="240131",
            sku_code="3778875",
        )

        self.assertEqual(count, 7)
        query.select.assert_called_once_with("id", count="exact", head=True)
        query.execute.assert_called_once_with()

    def test_fetch_rows_rejects_unbounded_or_oversized_requests(self):
        for limit in [0, 1_001]:
            with self.subTest(limit=limit):
                with self.assertRaises(ValueError):
                    supabase_service.fetch_bronze_rows(offset=0, limit=limit)


if __name__ == "__main__":
    unittest.main()
