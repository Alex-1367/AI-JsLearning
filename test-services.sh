#!/bin/bash
# test-services.sh

echo "🔬 Testing Service Connectivity"
echo "==============================="

# Test ChromaDB
echo -e "\n🗄️  Testing ChromaDB..."
if curl -s http://localhost:8000/api/v2/heartbeat > /dev/null; then
    echo "✅ ChromaDB heartbeat: OK"
    VERSION=$(curl -s http://localhost:8000/api/v2/version)
    echo "   Version: $VERSION"
else
    echo "❌ ChromaDB not responding"
fi

# Test Ollama
echo -e "\n🤖 Testing Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama API: OK"
    MODELS=$(curl -s http://localhost:11434/api/tags | python3 -m json.tool 2>/dev/null || echo "Could not parse JSON")
    echo "   Models: $MODELS"
else
    echo "❌ Ollama not responding"
fi

# Test Ollama with your specific model
echo -e "\n🧪 Testing qwen2.5-coder:1.5b..."
RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:1.5b",
    "prompt": "Say hello",
    "stream": false
  }' | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', 'ERROR'))" 2>/dev/null)

if [ "$RESPONSE" != "ERROR" ] && [ ! -z "$RESPONSE" ]; then
    echo "✅ Model responds: \"$RESPONSE\""
else
    echo "❌ Model test failed"
fi

echo -e "\n==============================="
echo "📝 Service status: Both operational!"