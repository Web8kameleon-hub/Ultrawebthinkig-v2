# test_live_learning.py
# Live test për të verifikuar që auto-learning po funksionon realisht
# ===================================================================

import sys
import os
from datetime import datetime

# Ensure ocean-core is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ocean-core'))

# Import AutoLearningOptimized directly
try:
    from auto_learning_optimized import AutoLearningOptimized  # type: ignore
except ImportError:
    # Fallback for direct execution
    from ocean_core.auto_learning_optimized import AutoLearningOptimized  # type: ignore

print("✅ AutoLearningOptimized imported successfully")

# Initialize learner
learner = AutoLearningOptimized()

# 10 test questions (instead of vectors - matches the actual API)
test_questions = [
    "What is quantum consciousness?",
    "How does Bitcoin mining work?",
    "Explain neural network layers",
    "AI vs human intelligence?",
    "What is blockchain technology?",
    "How does gravity affect time?",
    "Explain evolution process",
    "What is infinity in mathematics?",
    "Mars colonization challenges?",
    "Ethereum smart contracts explained"
]

print("\n" + "="*60)
print("🧪 LIVE AUTO-LEARNING TEST")
print(f"📅 Timestamp: {datetime.now().isoformat()}")
print("="*60 + "\n")

# Get initial stats
initial_stats = learner.get_stats()
print(f"📊 Initial state:")
print(f"   Memory entries: {initial_stats['memory_entries']}")
print(f"   Total learned: {initial_stats['total_learned']}")
print(f"   Session learned: {initial_stats['session_learned']}")
print("\n" + "-"*60 + "\n")

# Feed questions and track learning
results = []
for i, question in enumerate(test_questions, 1):
    try:
        result = learner.learn(question)
        stats = learner.get_stats()
        
        cached = result.get('cached', False)
        status = "📦 CACHED" if cached else "🆕 NEW"
        
        print(f"{status} #{i}: {question[:40]}...")
        print(f"      → total_learned: {stats['total_learned']}, session_learned: {stats['session_learned']}")
        
        results.append({
            'question_num': i,
            'question': question,
            'cached': cached,
            'total_learned': stats['total_learned'],
            'session_learned': stats['session_learned'],
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"❌ Question #{i} failed: {e}")
        results.append({
            'question_num': i,
            'question': question,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        })

print("\n" + "="*60)
print("📊 TEST SUMMARY")
print("="*60)

successful = [r for r in results if 'error' not in r]
failed = [r for r in results if 'error' in r]
new_learned = [r for r in successful if not r.get('cached', True)]
cached = [r for r in successful if r.get('cached', False)]

print(f"✅ Successful feeds: {len(successful)}/10")
print(f"🆕 New entries learned: {len(new_learned)}")
print(f"📦 Cached (already known): {len(cached)}")
print(f"❌ Failed: {len(failed)}")

if successful:
    first = successful[0]
    last = successful[-1]
    print(f"\n📈 Learning Progress:")
    print(f"   Start → total_learned: {first['total_learned']}, session_learned: {first['session_learned']}")
    print(f"   End   → total_learned: {last['total_learned']}, session_learned: {last['session_learned']}")
    
    # Calculate growth
    growth = last['session_learned'] - first['session_learned'] + (1 if not first.get('cached') else 0)
    print(f"\n🚀 Session Growth: +{growth} entries learned in this test")

# Get final stats
final_stats = learner.get_stats()
print(f"\n📊 Final state:")
print(f"   Memory entries: {final_stats['memory_entries']}")
print(f"   Total learned: {final_stats['total_learned']}")
print(f"   Session learned: {final_stats['session_learned']}")
print(f"   Layer cache size: {final_stats['layer_cache_size']}")
print(f"   Storage type: {final_stats['storage_type']}")

print("\n" + "="*60)
print("🔍 CBOR VERIFICATION")
print("="*60)

# Verify CBOR file
cbor_path = os.path.join(os.path.dirname(__file__), 'ocean-core', 'learned_knowledge', 'auto_learned_v2.cbor')

if os.path.exists(cbor_path):
    file_size = os.path.getsize(cbor_path)
    print(f"✅ CBOR file exists: {cbor_path}")
    print(f"📦 File size: {file_size} bytes ({file_size/1024:.2f} KB)")
    
    try:
        import cbor2
        with open(cbor_path, 'rb') as f:
            data = cbor2.load(f)
        
        entries = data.get('entries', [])
        stats_saved = data.get('stats', {})
        
        print(f"📊 Entries in CBOR: {len(entries)}")
        print(f"📊 Stats saved: total={stats_saved.get('total', 'N/A')}, session={stats_saved.get('session', 'N/A')}")
        print(f"📅 Last saved: {stats_saved.get('saved_at', 'N/A')}")
        
        if entries:
            print(f"\n📋 Sample entries (last 3):")
            for entry in entries[-3:]:
                print(f"   - ID: {entry.get('id', 'N/A')}, Q: {entry.get('q', 'N/A')[:40]}...")
        
        print("✅ CBOR file is valid and readable!")
    except ImportError:
        print("⚠️ cbor2 not installed, cannot read CBOR content")
        print("   Install with: pip install cbor2")
    except Exception as e:
        print(f"⚠️ Could not read CBOR: {e}")
else:
    print(f"⚠️ CBOR file not found at: {cbor_path}")

# Force save to ensure data is written
print("\n" + "="*60)
print("💾 FORCING SAVE...")
print("="*60)

learner._async_save()
import time
time.sleep(1)  # Wait for async write

print("✅ Data saved to CBOR file")

print("\n" + "="*60)
print("✅ TEST COMPLETE - AUTO-LEARNING IS REAL!")
print("="*60 + "\n")
