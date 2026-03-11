# After getting all paths, check for duplicates
sort all_indexed_paths.txt | uniq -d > duplicate_paths.txt

if [ -s duplicate_paths.txt ]; then
  echo "❌ Found duplicates:"
  cat duplicate_paths.txt
else
  echo "✅ No duplicates found!"
fi

# Count unique files
sort all_indexed_paths.txt | uniq | wc -l