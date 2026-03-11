sudo systemctl stop chromadb
mv /home/admin/chromadb_data /home/admin/chromadb_data_backup
rm data/state.json
sudo systemctl start chromadb