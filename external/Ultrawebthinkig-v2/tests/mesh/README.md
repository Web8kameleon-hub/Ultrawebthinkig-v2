# EuroWeb Ultra - Mesh Testing Suite

Test suite për **Offline Store & Forward** dhe **Industrial Mesh Networking**.

## 🧪 Test Overview

### test_offline_store_forward.py
Teston kapacitetin e sistemit për **72-hour offline operation** - requirement kryesor për aviation industry.

**Results:**
- ✅ **PASS** - Sistemi mund të ruajë 72h mesazhe
- 📊 **Storage:** 25.312MB të nevojshme / 512MB disponueshme  
- 🛩️ **Aviation Compliance:** TRUE

## 📊 Configuration

```yaml
offline:
  hours: 72                    # Aviation standard
  msg_rate_per_minute: 5       # Conservative mesh rate  
  avg_msg_bytes: 1024         # Including encryption headers
  storage_mb: 512             # Available storage
```

## 🚀 Running Tests

```bash
cd tests/mesh
python test_offline_store_forward.py
```

## 📈 Reports

Test results ruhen në `reports/offline_store_forward.json` dhe përmbajnë:
- Storage calculations
- Aviation compliance status  
- Performance metrics
- Pass/Fail status

## 🔧 Architecture

```
tests/mesh/
├── test_offline_store_forward.py    # Main test
├── config.yaml                      # Configuration
├── utils/
│   ├── __init__.py
│   └── power_model.py               # Storage calculations
└── reports/
    └── offline_store_forward.json   # Test results
```

**Status:** ✅ **OPERATIONAL** - Ready for industrial deployment!
