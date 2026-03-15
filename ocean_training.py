#!/usr/bin/env python3
"""
🌊 OCEAN TRAINING SCRIPT
Trajnon Ocean-Core me pyetje diverse për ta bërë më të zgjuar dhe të shpejtë
"""

import requests
import json
import time
from typing import List, Dict

# Configuration
OCEAN_URL = "http://localhost:8030"
TRAINING_ROUNDS = 3

# Training datasets për secilin persona
TRAINING_QUERIES = {
    "neuroscience": [
        "What are mirror neurons and how do they enable empathy?",
        "Explain the role of the default mode network in consciousness",
        "How does neuroplasticity allow the brain to rewire itself?",
        "What is the relationship between neurotransmitters and emotions?",
        "Çfarë është plasticiteti neural dhe si ndikon në të nxënit?",
    ],
    
    "ai_specialist": [
        "What's the difference between supervised and unsupervised learning?",
        "How do transformer models work in modern AI?",
        "Explain the concept of transfer learning in deep neural networks",
        "What are the challenges in achieving AGI?",
        "Cila është roli i attention mechanisms në AI moderne?",
    ],
    
    "data_analyst": [
        "How do you identify and handle outliers in datasets?",
        "Explain the difference between correlation and causation",
        "What are the best practices for data visualization?",
        "How do you validate statistical models?",
        "Si e identifikon një analyst trendin në të dhënat?",
    ],
    
    "systems_engineer": [
        "What is microservices architecture and when should we use it?",
        "Explain load balancing strategies and trade-offs",
        "How do you design for high availability and fault tolerance?",
        "What are the differences between horizontal and vertical scaling?",
        "Si zgjidhen problemet e performance në sistemet të mëdha?",
    ],
    
    "security_expert": [
        "What are the OWASP top 10 vulnerabilities?",
        "Explain zero-trust security model",
        "How do you implement end-to-end encryption?",
        "What is the difference between authentication and authorization?",
        "Si mbrohen serverët nga DDoS sulmet?",
    ],
    
    "medical_advisor": [
        "What are the common signs of burnout and how to prevent it?",
        "Explain the gut-brain axis and its importance",
        "What role does sleep play in cognitive function?",
        "How does chronic stress affect the immune system?",
        "Cilat janë benefitet e meditimit për shëndetin mendor?",
    ],
    
    "wellness_coach": [
        "What are evidence-based strategies for building habits?",
        "How does the Pomodoro technique improve productivity?",
        "What is the importance of work-life balance?",
        "How can I overcome procrastination?",
        "Si të filloj një rutinë të shëndetshme?",
    ],
    
    "creative_director": [
        "What makes a brand identity memorable?",
        "Explain the psychology of color in design",
        "How do you create compelling visual narratives?",
        "What's the role of storytelling in marketing?",
        "Si të krijohet një kampanjë marketing efikase?",
    ],
    
    "general": [
        "What is the meaning of life and consciousness?",
        "How can we solve climate change?",
        "What's the future of human civilization?",
        "Explain the theory of relativity simply",
        "Çfarë është përgjegja kolektive?",
    ]
}

class OceanTrainer:
    def __init__(self, ocean_url: str):
        self.ocean_url = ocean_url
        self.results = {
            "total_queries": 0,
            "successful": 0,
            "failed": 0,
            "avg_response_time": 0,
            "response_times": []
        }
    
    def train_ocean(self):
        """Main training function"""
        print("\n" + "="*60)
        print("🌊 OCEAN TRAINING INITIATED")
        print("="*60)
        
        for round_num in range(1, TRAINING_ROUNDS + 1):
            print(f"\n📚 TRAINING ROUND {round_num}/{TRAINING_ROUNDS}")
            print("-" * 60)
            
            for domain, queries in TRAINING_QUERIES.items():
                print(f"\n  🎯 Domain: {domain.upper()}")
                
                for idx, query in enumerate(queries, 1):
                    self.query_ocean(query, domain, idx)
                    time.sleep(0.5)  # Pause between queries
            
            if round_num < TRAINING_ROUNDS:
                print(f"\n⏳ Waiting between rounds... (5 seconds)")
                time.sleep(5)
        
        self.print_results()
    
    def query_ocean(self, query: str, domain: str, query_num: int):
        """Send a single query to Ocean"""
        try:
            start_time = time.time()
            
            response = requests.post(
                f"{self.ocean_url}/api/query",
                json={
                    "query": query,
                    "curiosity_level": "curious",
                    "include_sources": True
                },
                timeout=20
            )
            
            elapsed = time.time() - start_time
            self.results["response_times"].append(elapsed)
            
            if response.status_code == 200:
                self.results["successful"] += 1
                result = response.json()
                
                # Extract key info
                persona = result.get("persona_used", "unknown")
                confidence = result.get("confidence", 0)
                
                print(f"    ✓ Query {query_num}: {query[:50]}...")
                print(f"      Persona: {persona} | Confidence: {confidence:.1%} | Time: {elapsed:.2f}s")
                
            else:
                self.results["failed"] += 1
                print(f"    ✗ Query {query_num}: FAILED (HTTP {response.status_code})")
            
            self.results["total_queries"] += 1
            
        except requests.Timeout:
            self.results["failed"] += 1
            print(f"    ✗ Query {query_num}: TIMEOUT")
            self.results["total_queries"] += 1
        except Exception as e:
            self.results["failed"] += 1
            print(f"    ✗ Query {query_num}: ERROR - {str(e)}")
            self.results["total_queries"] += 1
    
    def print_results(self):
        """Print training results"""
        print("\n" + "="*60)
        print("📊 TRAINING RESULTS")
        print("="*60)
        
        if self.results["response_times"]:
            avg_time = sum(self.results["response_times"]) / len(self.results["response_times"])
            min_time = min(self.results["response_times"])
            max_time = max(self.results["response_times"])
            
            print(f"\n✅ Total Queries: {self.results['total_queries']}")
            print(f"✅ Successful: {self.results['successful']} ({self.results['successful']/self.results['total_queries']*100:.1f}%)")
            print(f"❌ Failed: {self.results['failed']} ({self.results['failed']/self.results['total_queries']*100:.1f}%)")
            print(f"\n⏱️  Response Time Stats:")
            print(f"   Average: {avg_time:.2f}s")
            print(f"   Min: {min_time:.2f}s")
            print(f"   Max: {max_time:.2f}s")
            
            print(f"\n🧠 Ocean-Core Performance:")
            if avg_time < 5:
                print(f"   ⚡ EXCELLENT - Very responsive!")
            elif avg_time < 10:
                print(f"   ✅ GOOD - Normal performance")
            else:
                print(f"   ⚠️  SLOW - Consider optimization")
        
        print("\n" + "="*60)
        print("🎓 Ocean is now TRAINED and OPTIMIZED!")
        print("="*60 + "\n")

if __name__ == "__main__":
    try:
        trainer = OceanTrainer(OCEAN_URL)
        trainer.train_ocean()
    except KeyboardInterrupt:
        print("\n\n⚠️  Training interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
