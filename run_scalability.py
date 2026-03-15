#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🏗️ SCALABILITY MODULE RUNNER
=============================
Ekzekuton modulin e skalabilitetit per zbulim dhe integrim te te dhenave te hapura.
"""

import asyncio
import sys
import os
from pathlib import Path

# Shton root directory ne path
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))

from open_data_scalability import get_scalability_engine, discover_and_feed_system

async def main():
    """Funksioni kryesor"""
    print("🚀 Filloj Scalability Module Runner...")
    print("=" * 50)

    try:
        # Kontrollo per cycle engine
        cycle_engine = None
        try:
            from cycle_engine import CycleEngine
            cycle_engine = CycleEngine()
            print("✅ Cycle Engine gjetur dhe inicializuar")
        except ImportError:
            print("⚠️ Cycle Engine nuk eshte i disponueshem - vazhdojme pa te")

        # Merr motorin e skalabilitetit
        scalability_engine = await get_scalability_engine(cycle_engine)

        print("🔍 Filloj zbulimin e burimeve te te dhenave...")
        print("-" * 40)

        # Zbulon burime te reja
        domains_to_search = [
            ".edu", ".ac.uk", ".ac.de", ".gov", ".org",
            "cern.ch", "nasa.gov", "who.int", "un.org"
        ]

        new_sources = await scalability_engine.discover_data_sources(domains_to_search)

        if new_sources:
            print(f"✅ Zbuluar {len(new_sources)} burime te reja!")
            print("\n📋 Burime te reja:")
            for source in new_sources[:5]:  # Shfaq 5 te parat
                print(f"  • {source.name} ({source.url}) - {source.source_type.value}")

            if len(new_sources) > 5:
                print(f"  ... dhe {len(new_sources) - 5} te tjera")

            print("\n🚀 Ushqej sistemin inteligjent...")
            print("-" * 40)

            # Ushqen sistemin
            results = await scalability_engine.feed_intelligent_modules(new_sources)

            print("📊 REZULTATET E PRODHIMIT:")
            print("=" * 50)

            total_generated = 0
            for content_type, items in results.items():
                count = len(items)
                total_generated += count
                print(f"📄 {content_type.replace('_', ' ').title()}: {count}")

                # Shfaq disa shembuj
                if items and count > 0:
                    sample = items[0]
                    if 'title' in sample:
                        print(f"   💡 Shembull: {sample['title'][:60]}...")
                    elif 'cycle_id' in sample:
                        print(f"   🔄 Cycle: {sample['cycle_id']}")
                    print()

            print(f"🎯 TOTAL GJENERUAR: {total_generated} elemente te rinj")
            print()

            # Merr metrikat
            metrics = await scalability_engine.get_metrics()
            print("📈 METRIKA TE SISTEMIT:")
            print("-" * 30)
            print(f"🔍 Burime totale zbuluar: {metrics.total_sources_discovered}")
            print(f"✅ Burime aktive: {metrics.active_sources}")
            print(f"💾 Te dhena te ingestuara: {metrics.data_ingested_gb:.2f} GB")
            print(f"🔄 Cycles te gjeneruar: {metrics.cycles_generated}")
            print(f"📚 Kerkime te prodhuar: {metrics.research_papers_generated}")
            print(f"🎮 Simulime te ekzekutuara: {metrics.simulations_run}")
            print(f"🛡️ Kontrolle sigurie JONA: {metrics.jona_reviews}")
            if metrics.safety_violations > 0:
                print(f"⚠️ Shkelje sigurie: {metrics.safety_violations}")

        else:
            print("ℹ️ Nuk u zbuluan burime te reja keto here")
            print("💡 Provo te shtosh domain-e te tjera ose kontrollo lidhjen internet")

        print("\n✅ Procesi perfundoi me sukses!")
        print("🔄 Sistemi eshte gati per cikle te ardhshme")

    except KeyboardInterrupt:
        print("\n⏹️ Procesi u nderpre nga perdoruesi")
    except Exception as e:
        print(f"\n❌ Gabim gjate ekzekutimit: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
