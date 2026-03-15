#!/usr/bin/env python3
"""
Ocean Multimodal Test Client
=============================
Test all sensory pipelines: Vision, Audio, Document, Reasoning
"""
import asyncio
import logging
import sys

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s"
)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8031"
TEST_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
TEST_AUDIO_B64 = "SUQzBAAAAAAAI1RTVEUAAAAAAAAAAAAAAAA"
TEST_DOCUMENT = "The quick brown fox jumps over the lazy dog. This is a test document for the Ocean multimodal pipeline."

class OceanTestClient:
    """Test client for Ocean Multimodal API"""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)
        self.results = []
    
    async def test_health(self):
        """Test health endpoint"""
        logger.info("🏥 Testing health endpoint...")
        try:
            response = await self.client.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Health check passed")
                logger.info(f"   Pipelines: {data['pipelines']}")
                logger.info(f"   Uptime: {data['uptime_seconds']:.1f}s")
                self.results.append(("health", "PASS", data))
                return True
            else:
                logger.error(f"❌ Health check failed: {response.status_code}")
                self.results.append(("health", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
            self.results.append(("health", "ERROR", str(e)))
            return False
    
    async def test_vision(self):
        """Test vision pipeline"""
        logger.info("👁️  Testing vision pipeline...")
        try:
            payload = {
                "image_base64": TEST_IMAGE_B64,
                "prompt": "What's in this image?",
                "analyze_objects": True,
                "extract_text": True
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/vision",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Vision analysis passed")
                logger.info(f"   Processing time: {data.get('processing_time_ms', 0):.1f}ms")
                logger.info(f"   Confidence: {data.get('confidence', 'N/A')}")
                self.results.append(("vision", "PASS", data))
                return True
            else:
                logger.error(f"❌ Vision analysis failed: {response.status_code}")
                self.results.append(("vision", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Vision error: {e}")
            self.results.append(("vision", "ERROR", str(e)))
            return False
    
    async def test_audio(self):
        """Test audio pipeline"""
        logger.info("🎙️  Testing audio pipeline...")
        try:
            payload = {
                "audio_base64": TEST_AUDIO_B64,
                "language": "en",
                "include_timestamps": True
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/audio",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Audio transcription passed")
                logger.info(f"   Transcript length: {len(data.get('transcript', ''))}")
                logger.info(f"   Processing time: {data.get('processing_time_ms', 0):.1f}ms")
                self.results.append(("audio", "PASS", data))
                return True
            else:
                logger.error(f"❌ Audio transcription failed: {response.status_code}")
                self.results.append(("audio", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Audio error: {e}")
            self.results.append(("audio", "ERROR", str(e)))
            return False
    
    async def test_document(self):
        """Test document pipeline"""
        logger.info("📄 Testing document pipeline...")
        try:
            payload = {
                "content": TEST_DOCUMENT,
                "doc_type": "text",
                "analyze_entities": True,
                "extract_summary": True
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/document",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Document analysis passed")
                logger.info(f"   Word count: {data.get('word_count', 0)}")
                logger.info(f"   Processing time: {data.get('processing_time_ms', 0):.1f}ms")
                self.results.append(("document", "PASS", data))
                return True
            else:
                logger.error(f"❌ Document analysis failed: {response.status_code}")
                self.results.append(("document", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Document error: {e}")
            self.results.append(("document", "ERROR", str(e)))
            return False
    
    async def test_reasoning(self):
        """Test reasoning pipeline"""
        logger.info("🧠 Testing reasoning pipeline...")
        try:
            payload = {
                "prompt": "What are the implications of artificial intelligence?",
                "context": {"domain": "technology"}
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/reason",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Reasoning passed")
                logger.info(f"   Response length: {len(data.get('reasoning', ''))}")
                logger.info(f"   Processing time: {data.get('processing_time_ms', 0):.1f}ms")
                self.results.append(("reasoning", "PASS", data))
                return True
            else:
                logger.error(f"❌ Reasoning failed: {response.status_code}")
                self.results.append(("reasoning", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Reasoning error: {e}")
            self.results.append(("reasoning", "ERROR", str(e)))
            return False
    
    async def test_multimodal(self):
        """Test multimodal fusion"""
        logger.info("🔄 Testing multimodal fusion...")
        try:
            payload = {
                "mode": "multimodal",
                "vision_input": {
                    "image_base64": TEST_IMAGE_B64,
                    "prompt": "Analyze this"
                },
                "audio_input": {
                    "audio_base64": TEST_AUDIO_B64,
                    "language": "en"
                },
                "document_input": {
                    "content": TEST_DOCUMENT,
                    "doc_type": "text"
                }
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/analyze",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Multimodal fusion passed")
                logger.info(f"   Processing time: {data.get('processing_time_ms', 0):.1f}ms")
                self.results.append(("multimodal", "PASS", data))
                return True
            else:
                logger.error(f"❌ Multimodal fusion failed: {response.status_code}")
                self.results.append(("multimodal", "FAIL", response.text))
                return False
        except Exception as e:
            logger.error(f"❌ Multimodal error: {e}")
            self.results.append(("multimodal", "ERROR", str(e)))
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        logger.info("=" * 70)
        logger.info("🌊 Ocean Multimodal Test Suite")
        logger.info("=" * 70)
        
        tests = [
            self.test_health,
            self.test_vision,
            self.test_audio,
            self.test_document,
            self.test_reasoning,
            self.test_multimodal
        ]
        
        for test in tests:
            await test()
            logger.info("-" * 70)
        
        await self.client.aclose()
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        logger.info("=" * 70)
        logger.info("📊 Test Summary")
        logger.info("=" * 70)
        
        passed = sum(1 for _, status, _ in self.results if status == "PASS")
        failed = sum(1 for _, status, _ in self.results if status == "FAIL")
        errors = sum(1 for _, status, _ in self.results if status == "ERROR")
        total = len(self.results)
        
        for name, status, result in self.results:
            icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
            logger.info(f"{icon} {name:15} | {status:6}")
        
        logger.info("=" * 70)
        logger.info(f"Total: {total} | Passed: {passed} | Failed: {failed} | Errors: {errors}")
        logger.info(f"Success Rate: {(passed/total*100):.1f}%")
        logger.info("=" * 70)
        
        return passed == total

async def main():
    """Main test runner"""
    client = OceanTestClient()
    success = await client.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
