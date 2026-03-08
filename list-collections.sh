ls -la /home/admin/chromadb_data/
curl "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections?limit=20" | jq
# js_examples MAIN COLLECTION - Contains all JS examples	✅ ACTIVE
# clean_test	From your verbose test script	🧪 Test
# verbose_test	Another test collection	🧪 Test
# knowledge_base	From early RAG testing	🧪 Test
# test_collection_v2	Testing v2 API	🧪 Test
# test_* (5 of them)	Various test runs with timestamps	🧪 Test