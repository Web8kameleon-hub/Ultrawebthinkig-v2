#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌍 MULTILINGUAL TEST - 11 Gjuhë
Teston Ocean Core me pyetje komplekse në të gjitha gjuhët
"""
import asyncio
import httpx
import time

OCEAN_URL = "http://localhost:8030"
OLLAMA_URL = "http://localhost:11434"

# Pyetje komplekse për çdo gjuhë - 22 GJUHË TOTAL
MULTILINGUAL_QUERIES = {
    # === GJUHËT ORIGJINALE (11) ===
    "sq": {
        "name": "🇦🇱 Shqip",
        "queries": [
            "Kush je ti dhe çfarë mund të bësh?",
            "Sa bën 15 herë 23 plus 47?",
        ]
    },
    "en": {
        "name": "🇬🇧 English",
        "queries": [
            "Who are you and what can you do?",
            "What is 15 times 23 plus 47?",
        ]
    },
    "de": {
        "name": "🇩🇪 Deutsch",
        "queries": [
            "Wer bist du und was kannst du machen?",
            "Was ist 15 mal 23 plus 47?",
        ]
    },
    "fr": {
        "name": "🇫🇷 Français",
        "queries": [
            "Qui es-tu et que peux-tu faire?",
            "Combien font 15 fois 23 plus 47?",
        ]
    },
    "it": {
        "name": "🇮🇹 Italiano",
        "queries": [
            "Chi sei e cosa puoi fare?",
            "Quanto fa 15 per 23 più 47?",
        ]
    },
    "es": {
        "name": "🇪🇸 Español",
        "queries": [
            "¿Quién eres y qué puedes hacer?",
            "¿Cuánto es 15 por 23 más 47?",
        ]
    },
    "pt": {
        "name": "🇵🇹 Português",
        "queries": [
            "Quem és tu e o que podes fazer?",
            "Quanto é 15 vezes 23 mais 47?",
        ]
    },
    "tr": {
        "name": "🇹🇷 Türkçe",
        "queries": [
            "Sen kimsin ve ne yapabilirsin?",
            "15 çarpı 23 artı 47 kaç eder?",
        ]
    },
    "sr": {
        "name": "🇷🇸 Srpski",
        "queries": [
            "Ko si ti i šta možeš da uradiš?",
            "Koliko je 15 puta 23 plus 47?",
        ]
    },
    "mk": {
        "name": "🇲🇰 Македонски",
        "queries": [
            "Кој си ти и што можеш да направиш?",
            "Колку е 15 пати 23 плус 47?",
        ]
    },
    "el": {
        "name": "🇬🇷 Ελληνικά",
        "queries": [
            "Ποιος είσαι και τι μπορείς να κάνεις;",
            "Πόσο κάνει 15 επί 23 συν 47;",
        ]
    },
    # === GJUHËT E REJA (11) ===
    "ar": {
        "name": "🇸🇦 العربية (Arabic)",
        "queries": [
            "من أنت وماذا يمكنك أن تفعل؟",
            "كم يساوي 15 ضرب 23 زائد 47؟",
        ]
    },
    "zh": {
        "name": "🇨🇳 中文 (Mandarin)",
        "queries": [
            "你是谁，你能做什么？",
            "15乘以23加47等于多少？",
        ]
    },
    "hi": {
        "name": "🇮🇳 हिन्दी (Hindi)",
        "queries": [
            "तुम कौन हो और तुम क्या कर सकते हो?",
            "15 गुणा 23 जमा 47 कितना होता है?",
        ]
    },
    "ru": {
        "name": "🇷🇺 Русский (Russian)",
        "queries": [
            "Кто ты и что ты можешь делать?",
            "Сколько будет 15 умножить на 23 плюс 47?",
        ]
    },
    "fa": {
        "name": "🇮🇷 فارسی (Persian/Farsi)",
        "queries": [
            "تو کی هستی و چه کاری می‌توانی انجام دهی؟",
            "۱۵ ضربدر ۲۳ به علاوه ۴۷ چند می‌شود؟",
        ]
    },
    "he": {
        "name": "🇮🇱 עברית (Hebrew)",
        "queries": [
            "מי אתה ומה אתה יכול לעשות?",
            "כמה זה 15 כפול 23 ועוד 47?",
        ]
    },
    "ja": {
        "name": "🇯🇵 日本語 (Japanese)",
        "queries": [
            "あなたは誰ですか、何ができますか？",
            "15かける23たす47はいくつですか？",
        ]
    },
    "ko": {
        "name": "🇰🇷 한국어 (Korean)",
        "queries": [
            "당신은 누구이고 무엇을 할 수 있나요?",
            "15 곱하기 23 더하기 47은 얼마인가요?",
        ]
    },
    "vi": {
        "name": "🇻🇳 Tiếng Việt (Vietnamese)",
        "queries": [
            "Bạn là ai và bạn có thể làm gì?",
            "15 nhân 23 cộng 47 bằng bao nhiêu?",
        ]
    },
    "th": {
        "name": "🇹🇭 ภาษาไทย (Thai)",
        "queries": [
            "คุณเป็นใครและคุณทำอะไรได้บ้าง?",
            "15 คูณ 23 บวก 47 เท่ากับเท่าไหร่?",
        ]
    },
    "uk": {
        "name": "🇺🇦 Українська (Ukrainian)",
        "queries": [
            "Хто ти і що ти можеш робити?",
            "Скільки буде 15 помножити на 23 плюс 47?",
        ]
    },
}

async def test_ocean_chat(message: str):
    """Test Ocean Core chat endpoint"""
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            start = time.perf_counter()
            r = await client.post(
                f"{OCEAN_URL}/api/v1/chat",
                json={"message": message}
            )
            elapsed = (time.perf_counter() - start) * 1000
            
            if r.status_code == 200:
                data = r.json()
                return {
                    "success": True,
                    "response": data.get("response", "")[:200],
                    "time_ms": elapsed
                }
            return {"success": False, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)[:50]}

async def main():
    print("=" * 70)
    print("🌍 MULTILINGUAL TEST - Ocean Core 8030")
    print("=" * 70)
    
    # Check Ocean Core
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{OCEAN_URL}/health")
            if r.status_code != 200:
                print("❌ Ocean Core nuk është aktiv!")
                return
            print("✅ Ocean Core aktiv\n")
        except:
            print("❌ Ocean Core nuk u gjet! Starto me:")
            print("   python asi_lite_server.py")
            return
    
    results = {}
    total_tests = 0
    passed_tests = 0
    
    for lang_code, lang_data in MULTILINGUAL_QUERIES.items():
        print(f"\n{'─' * 70}")
        print(f"{lang_data['name']}")
        print(f"{'─' * 70}")
        
        lang_results = []
        
        for i, query in enumerate(lang_data["queries"], 1):
            total_tests += 1
            print(f"\n  📝 Pyetja {i}: {query[:50]}...")
            
            result = await test_ocean_chat(query)
            lang_results.append(result)
            
            if result["success"]:
                passed_tests += 1
                print(f"  ✅ {result['time_ms']:.0f}ms")
                print(f"  💬 {result['response'][:100]}...")
            else:
                print(f"  ❌ {result['error']}")
        
        results[lang_code] = lang_results
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 PËRMBLEDHJE")
    print("=" * 70)
    
    print(f"\n✅ Kaluan: {passed_tests}/{total_tests} ({100*passed_tests/total_tests:.0f}%)")
    
    print("\n📈 Rezultatet sipas gjuhës:")
    for lang_code, lang_data in MULTILINGUAL_QUERIES.items():
        lang_results = results.get(lang_code, [])
        passed = sum(1 for r in lang_results if r.get("success"))
        avg_time = sum(r.get("time_ms", 0) for r in lang_results if r.get("success")) / max(passed, 1)
        status = "✅" if passed == len(lang_results) else "⚠️" if passed > 0 else "❌"
        print(f"  {status} {lang_data['name']}: {passed}/{len(lang_results)} - {avg_time:.0f}ms avg")
    
    print("\n" + "=" * 70)
    print("✅ TEST KOMPLET!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
