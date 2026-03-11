#!/bin/bash
# get-all-paths.sh

OFFSET=0
LIMIT=1000
TOTAL=36358
OUTPUT_FILE="all_indexed_paths.txt"

> $OUTPUT_FILE  # Clear file

while [ $OFFSET -lt $TOTAL ]; do
  echo "Fetching paths $OFFSET to $((OFFSET + LIMIT))..." >&2
  
  curl -s "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/615638f3-3b97-413b-97b1-921525dec2e1/get" \
    -H "Content-Type: application/json" \
    -d "{
      \"include\": [\"metadatas\"],
      \"limit\": $LIMIT,
      \"offset\": $OFFSET
    }" | jq -r '.metadatas[].path' >> $OUTPUT_FILE
  
  OFFSET=$((OFFSET + LIMIT))
done

echo "✅ Saved $(wc -l < $OUTPUT_FILE) paths to $OUTPUT_FILE" >&2