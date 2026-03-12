"""
DOCUMENT CONTRACTS - Governance contracts for industrial document generation.
Defines schemas, validation rules, and provenance tracking for documents.
"""

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ContractType(Enum):
    """Document contract types."""
    CPI = "cpi"
    RESEARCH = "research"
    REPORT = "report"
    DATA_EXPORT = "data_export"


class DocumentContract:
    """Base contract for document generation governance."""
    
    def __init__(self, 
                 title: str = "Untitled Document",
                 author: str = "Clisonix Ocean",
                 version: str = "1.0"):
        self.title = title
        self.author = author
        self.version = version
        self.created_at = datetime.utcnow().isoformat()
        self.contract_type = "generic"
        self.validation_rules = []
        self.metadata = {}
    
    def validate(self) -> Dict[str, Any]:
        """Validate contract integrity."""
        errors = []
        for rule in self.validation_rules:
            if not rule():
                errors.append(f"Validation rule failed: {rule.__doc__}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def get_data(self) -> Dict[str, Any]:
        """Extract data for document generation."""
        return {
            "title": self.title,
            "author": self.author,
            "version": self.version,
            "created_at": self.created_at,
            "contract_type": self.contract_type
        }
    
    def get_summary(self) -> str:
        """Get contract summary for document."""
        return f"Document: {self.title} | Type: {self.contract_type} | Version: {self.version}"
    
    def get_sections(self) -> List[Dict[str, str]]:
        """Get document sections."""
        return [
            {
                "title": "Header",
                "content": self.get_summary()
            },
            {
                "title": "Metadata",
                "content": f"Created: {self.created_at} | Author: {self.author}"
            }
        ]


class CPIReportContract(DocumentContract):
    """Contract for CPI (Customer Performance Index) reports."""
    
    def __init__(self):
        super().__init__(
            title="CPI Report - Customer Performance Index",
            author="Clisonix Ocean Document Engine",
            version="2.1"
        )
        self.contract_type = "cpi"
        self.metrics = {}
        self.benchmarks = {}
        self.recommendations = []
        
        # Validation rules
        self.validation_rules = [
            self._rule_has_metrics,
            self._rule_time_valid
        ]
    
    def _rule_has_metrics(self) -> bool:
        """Contract must have metrics defined."""
        return isinstance(self.metrics, dict)
    
    def _rule_time_valid(self) -> bool:
        """Contract timestamp must be valid."""
        try:
            datetime.fromisoformat(self.created_at)
            return True
        except:
            return False
    
    def add_metric(self, name: str, value: float, target: float = 0):
        """Add performance metric."""
        self.metrics[name] = {
            "value": value,
            "target": target,
            "variance": value - target,
            "unit": "percentage"
        }
    
    def add_recommendation(self, category: str, text: str, priority: str = "medium"):
        """Add improvement recommendation."""
        self.recommendations.append({
            "category": category,
            "text": text,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_data(self) -> Dict[str, Any]:
        """Extract CPI report data."""
        base = super().get_data()
        base.update({
            "metrics": self.metrics,
            "benchmarks": self.benchmarks,
            "recommendations_count": len(self.recommendations),
            "total_variance": sum(m.get("variance", 0) for m in self.metrics.values())
        })
        return base
    
    def get_summary(self) -> str:
        """Get CPI report summary."""
        metric_count = len(self.metrics)
        rec_count = len(self.recommendations)
        return f"""
CPI Report Summary
==================
Title: {self.title}
Metrics Tracked: {metric_count}
Recommendations: {rec_count}
Report Date: {self.created_at}
Version: {self.version}
        """.strip()
    
    def get_sections(self) -> List[Dict[str, str]]:
        """Get CPI report sections."""
        sections = [
            {
                "title": "Executive Summary",
                "content": self.get_summary()
            },
            {
                "title": "Performance Metrics",
                "content": f"Tracking {len(self.metrics)} key metrics"
            }
        ]
        
        if self.recommendations:
            rec_text = "\n".join([f"- {r['text']}" for r in self.recommendations])
            sections.append({
                "title": "Recommendations",
                "content": rec_text
            })
        
        return sections


class ResearchReportContract(DocumentContract):
    """Contract for research and analysis reports."""
    
    def __init__(self):
        super().__init__(
            title="Research Report",
            author="Clisonix Ocean Research Engine",
            version="1.0"
        )
        self.contract_type = "research"
        self.research_areas = []
        self.findings = []
        self.sources = []
        self.methodology = ""
        
        # Validation rules
        self.validation_rules = [
            self._rule_has_methodology,
            self._rule_valid_findings
        ]
    
    def _rule_has_methodology(self) -> bool:
        """Research must have methodology defined."""
        return isinstance(self.methodology, str) and len(self.methodology) > 0
    
    def _rule_valid_findings(self) -> bool:
        """Findings must be properly structured."""
        return isinstance(self.findings, list)
    
    def set_methodology(self, methodology: str):
        """Set research methodology."""
        self.methodology = methodology
    
    def add_research_area(self, area: str):
        """Add research focus area."""
        self.research_areas.append(area)
    
    def add_finding(self, finding: str, confidence: float = 0.8):
        """Add research finding."""
        self.findings.append({
            "text": finding,
            "confidence": confidence,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def add_source(self, title: str, url: str = "", authors: List[str] = None):
        """Add research source."""
        self.sources.append({
            "title": title,
            "url": url,
            "authors": authors or [],
            "accessed": datetime.utcnow().isoformat()
        })
    
    def get_data(self) -> Dict[str, Any]:
        """Extract research report data."""
        base = super().get_data()
        base.update({
            "research_areas": self.research_areas,
            "findings_count": len(self.findings),
            "sources_count": len(self.sources),
            "methodology_length": len(self.methodology)
        })
        return base
    
    def get_summary(self) -> str:
        """Get research report summary."""
        return f"""
Research Report Summary
=======================
Title: {self.title}
Research Areas: {', '.join(self.research_areas) if self.research_areas else 'General'}
Findings: {len(self.findings)}
Sources: {len(self.sources)}
Published: {self.created_at}
        """.strip()
    
    def get_sections(self) -> List[Dict[str, str]]:
        """Get research report sections."""
        sections = [
            {
                "title": "Abstract",
                "content": self.get_summary()
            },
            {
                "title": "Methodology",
                "content": self.methodology
            },
            {
                "title": "Research Areas",
                "content": ", ".join(self.research_areas) if self.research_areas else "General research"
            },
            {
                "title": "Key Findings",
                "content": "\n".join([f"- {f['text']} (confidence: {f['confidence']:.0%})" for f in self.findings]) if self.findings else "No findings yet"
            }
        ]
        
        if self.sources:
            sources_text = "\n".join([f"- {s['title']}" for s in self.sources])
            sections.append({
                "title": "Sources",
                "content": sources_text
            })
        
        return sections


class GeneralReportContract(DocumentContract):
    """Generic contract for general-purpose reports."""
    
    def __init__(self):
        super().__init__(
            title="General Report",
            author="Clisonix Ocean",
            version="1.0"
        )
        self.contract_type = "report"
        self.sections_data = []
    
    def add_section(self, title: str, content: str):
        """Add report section."""
        self.sections_data.append({
            "title": title,
            "content": content
        })
    
    def get_sections(self) -> List[Dict[str, str]]:
        """Get report sections."""
        if self.sections_data:
            return self.sections_data
        return super().get_sections()


class VideoContract(DocumentContract):
    """Contract for video document generation (Blerina + Animated)."""
    
    def __init__(self):
        super().__init__(
            title="Video Document",
            author="Clisonix Ocean Video Engine",
            version="2.0"
        )
        self.contract_type = "video"
        self.video_style = "educational"
        self.voice_style = "professional"
        self.target_duration = 300
        self.scenes = []
        self.background_music = False
        self.subtitles_enabled = True
        self.languages = ["en"]
        
        self.validation_rules = [
            self._rule_has_scenes,
            self._rule_valid_duration
        ]
    
    def _rule_has_scenes(self) -> bool:
        return len(self.scenes) > 0 or True
    
    def _rule_valid_duration(self) -> bool:
        return 10 < self.target_duration < 3600
    
    def add_scene(self, title: str, narration: str, image_prompt: str = "", duration: float = 5.0):
        self.scenes.append({
            "title": title,
            "narration": narration,
            "image_prompt": image_prompt,
            "duration": duration,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def set_video_style(self, style: str):
        valid_styles = ["educational", "documentary", "tutorial", "presentation", "social_media"]
        self.video_style = style if style in valid_styles else "educational"
    
    def get_data(self) -> Dict[str, Any]:
        base = super().get_data()
        base.update({
            "video_style": self.video_style,
            "voice_style": self.voice_style,
            "target_duration": self.target_duration,
            "scenes_count": len(self.scenes),
            "total_scenes_duration": sum(s.get("duration", 0) for s in self.scenes),
            "subtitles": self.subtitles_enabled,
            "languages": self.languages
        })
        return base
    
    def get_summary(self) -> str:
        return f"Video Project: {self.title} | Style: {self.video_style} | Scenes: {len(self.scenes)}"
    
    def get_sections(self) -> List[Dict[str, str]]:
        sections = [{"title": "Video Project", "content": self.get_summary()}]
        for i, scene in enumerate(self.scenes):
            sections.append({
                "title": f"Scene {i+1}: {scene.get('title', 'Untitled')}",
                "content": scene.get('narration', '')
            })
        return sections


class VoiceContract(DocumentContract):
    """Contract for voice/audio document generation."""
    
    def __init__(self):
        super().__init__(
            title="Voice Document",
            author="Clisonix Ocean Voice Engine",
            version="1.0"
        )
        self.contract_type = "voice"
        self.voice_style = "professional"
        self.language = "en"
        self.sample_rate = 22050
        self.audio_format = "wav"
        self.background_music = False
        self.sound_effects = False
        self.segments = []
        
        self.validation_rules = [
            self._rule_has_segments,
            self._rule_valid_sample_rate
        ]
    
    def _rule_has_segments(self) -> bool:
        return len(self.segments) > 0 or True
    
    def _rule_valid_sample_rate(self) -> bool:
        return self.sample_rate in [8000, 16000, 22050, 44100, 48000]
    
    def add_segment(self, text: str, style: str = "professional", duration: float = 0.0):
        self.segments.append({
            "text": text,
            "style": style,
            "duration": duration or (len(text.split()) / 130),
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def set_voice_style(self, style: str):
        valid_styles = ["professional", "friendly", "narrator", "energetic"]
        self.voice_style = style if style in valid_styles else "professional"
    
    def get_data(self) -> Dict[str, Any]:
        base = super().get_data()
        total_duration = sum(s.get("duration", 0) for s in self.segments)
        base.update({
            "voice_style": self.voice_style,
            "language": self.language,
            "segments_count": len(self.segments),
            "total_duration": total_duration
        })
        return base
    
    def get_summary(self) -> str:
        total_duration = sum(s.get("duration", 0) for s in self.segments)
        return f"Voice Document: {self.title} | Style: {self.voice_style} | Segments: {len(self.segments)} | Duration: {total_duration:.1f}s"
    
    def get_sections(self) -> List[Dict[str, str]]:
        sections = [{"title": "Voice Project", "content": self.get_summary()}]
        for i, segment in enumerate(self.segments):
            sections.append({
                "title": f"Segment {i+1}",
                "content": segment.get('text', '')
            })
        return sections


class MusicContract(DocumentContract):
    """Contract for music/background score generation."""
    
    def __init__(self):
        super().__init__(
            title="Music Document",
            author="Clisonix Ocean Music Engine",
            version="1.0"
        )
        self.contract_type = "music"
        self.music_genre = "ambient"
        self.bpm = 120
        self.key = "C"
        self.time_signature = "4/4"
        self.duration_seconds = 300
        self.instruments = ["piano", "strings"]
        self.intensity = "moderate"
        self.mood = "calm"
        self.language = "en"
        
        self.validation_rules = [
            self._rule_valid_bpm,
            self._rule_valid_duration
        ]
    
    def _rule_valid_bpm(self) -> bool:
        return 40 < self.bpm < 300
    
    def _rule_valid_duration(self) -> bool:
        return 5 < self.duration_seconds < 1800
    
    def set_genre(self, genre: str):
        valid_genres = ["ambient", "electronic", "classical", "jazz", "orchestral", "experimental"]
        self.music_genre = genre if genre in valid_genres else "ambient"
    
    def set_mood(self, mood: str):
        valid_moods = ["calm", "energetic", "melancholic", "triumphant", "mysterious", "uplifting"]
        self.mood = mood if mood in valid_moods else "calm"
    
    def add_instrument(self, instrument: str):
        if instrument not in self.instruments:
            self.instruments.append(instrument)
    
    def get_data(self) -> Dict[str, Any]:
        base = super().get_data()
        base.update({
            "genre": self.music_genre,
            "bpm": self.bpm,
            "key": self.key,
            "time_signature": self.time_signature,
            "duration_seconds": self.duration_seconds,
            "instruments": self.instruments,
            "intensity": self.intensity,
            "mood": self.mood
        })
        return base
    
    def get_summary(self) -> str:
        return f"Music Score: {self.title} | Genre: {self.music_genre} | BPM: {self.bpm} | Mood: {self.mood} | Duration: {self.duration_seconds}s"
    
    def get_sections(self) -> List[Dict[str, str]]:
        sections = [
            {"title": "Metadata", "content": self.get_summary()},
            {"title": "Instruments", "content": ", ".join(self.instruments)},
            {"title": "Composition Details", "content": f"Key: {self.key} | Time: {self.time_signature} | BPM: {self.bpm}"}
        ]
        return sections


class PaintingContract(DocumentContract):
    """Contract for image/painting generation."""
    
    def __init__(self):
        super().__init__(
            title="Painting Document",
            author="Clisonix Ocean Painting Engine",
            version="1.0"
        )
        self.contract_type = "painting"
        self.style = "digital_art"
        self.theme = "abstract"
        self.width = 1920
        self.height = 1080
        self.color_palette = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A"]
        self.lighting = "natural"
        self.composition = "balanced"
        self.elements = []
        
        self.validation_rules = [
            self._rule_valid_dimensions,
            self._rule_has_palette
        ]
    
    def _rule_valid_dimensions(self) -> bool:
        return (512 <= self.width <= 4096) and (512 <= self.height <= 4096)
    
    def _rule_has_palette(self) -> bool:
        return len(self.color_palette) >= 2
    
    def set_style(self, style: str):
        valid_styles = ["digital_art", "watercolor", "oil_painting", "pencil_sketch", "abstract", "photorealistic"]
        self.style = style if style in valid_styles else "digital_art"
    
    def add_element(self, element_type: str, description: str, position: str = "center"):
        self.elements.append({
            "type": element_type,
            "description": description,
            "position": position,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def set_color_palette(self, colors: List[str]):
        self.color_palette = colors if len(colors) >= 2 else self.color_palette
    
    def get_data(self) -> Dict[str, Any]:
        base = super().get_data()
        base.update({
            "style": self.style,
            "theme": self.theme,
            "dimensions": f"{self.width}x{self.height}",
            "color_palette": self.color_palette,
            "lighting": self.lighting,
            "composition": self.composition,
            "elements_count": len(self.elements)
        })
        return base
    
    def get_summary(self) -> str:
        return f"Painting: {self.title} | Style: {self.style} | Theme: {self.theme} | Size: {self.width}x{self.height}px | Colors: {len(self.color_palette)}"
    
    def get_sections(self) -> List[Dict[str, str]]:
        sections = [
            {"title": "Artwork Metadata", "content": self.get_summary()},
            {"title": "Color Palette", "content": " ".join(self.color_palette)},
            {"title": "Composition", "content": f"Lighting: {self.lighting} | Composition: {self.composition}"}
        ]
        if self.elements:
            elem_text = "\n".join([f"- {e['description']} ({e['type']})" for e in self.elements])
            sections.append({"title": "Elements", "content": elem_text})
        return sections


class AnimationContract(DocumentContract):
    """Contract for animation/motion graphics generation."""
    
    def __init__(self):
        super().__init__(
            title="Animation Document",
            author="Clisonix Ocean Animation Engine",
            version="1.0"
        )
        self.contract_type = "animation"
        self.animation_style = "modern"
        self.fps = 30
        self.duration_seconds = 60
        self.resolution = "1080p"
        self.frames = []
        self.transitions = []
        self.effects = []
        
        self.validation_rules = [
            self._rule_valid_fps,
            self._rule_valid_duration
        ]
    
    def _rule_valid_fps(self) -> bool:
        return self.fps in [24, 25, 30, 60]
    
    def _rule_valid_duration(self) -> bool:
        return 1 < self.duration_seconds < 600
    
    def add_frame(self, description: str, duration: float = 1.0):
        frame_num = len(self.frames)
        self.frames.append({
            "frame_number": frame_num,
            "description": description,
            "duration": duration,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def add_transition(self, transition_type: str, duration: float = 0.5):
        self.transitions.append({
            "type": transition_type,
            "duration": duration,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def add_effect(self, effect_name: str, parameters: Dict[str, Any] = None):
        self.effects.append({
            "name": effect_name,
            "parameters": parameters or {},
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_data(self) -> Dict[str, Any]:
        base = super().get_data()
        base.update({
            "style": self.animation_style,
            "fps": self.fps,
            "duration_seconds": self.duration_seconds,
            "resolution": self.resolution,
            "frames_count": len(self.frames),
            "transitions_count": len(self.transitions),
            "effects_count": len(self.effects)
        })
        return base
    
    def get_summary(self) -> str:
        return f"Animation: {self.title} | Style: {self.animation_style} | Duration: {self.duration_seconds}s | FPS: {self.fps} | Frames: {len(self.frames)}"
    
    def get_sections(self) -> List[Dict[str, str]]:
        sections = [
            {"title": "Animation Metadata", "content": self.get_summary()},
            {"title": "Technical Specs", "content": f"Resolution: {self.resolution} | FPS: {self.fps}"}
        ]
        if self.frames:
            frames_text = "\n".join([f"Frame {f['frame_number']}: {f['description']} ({f['duration']}s)" for f in self.frames[:10]])
            sections.append({"title": "Keyframes", "content": frames_text})
        return sections


# Contract factory functions
def create_cpi_report_contract() -> CPIReportContract:
    """Factory for CPI report contracts."""
    contract = CPIReportContract()
    
    # Add sample metrics
    contract.add_metric("Response Time", 95.5, 90.0)
    contract.add_metric("Accuracy", 98.2, 97.0)
    contract.add_metric("Availability", 99.7, 99.0)
    
    # Add sample recommendations
    contract.add_recommendation("Performance", "Optimize database queries", "high")
    contract.add_recommendation("Security", "Update SSL certificates", "medium")
    
    return contract


def create_research_report_contract() -> ResearchReportContract:
    """Factory for research report contracts."""
    contract = ResearchReportContract()
    
    contract.set_methodology(
        "Mixed-methods approach combining quantitative analysis and qualitative interviews"
    )
    contract.add_research_area("AI Applications")
    contract.add_research_area("Industrial Automation")
    contract.add_research_area("Neural Intelligence")
    
    contract.add_finding("AI systems improve efficiency by 35-50%", 0.92)
    contract.add_finding("Integration challenges require domain expertise", 0.88)
    
    contract.add_source(
        "AI in Industry: A Comprehensive Study",
        "https://example.com/ai-study",
        ["Dr. Smith", "Dr. Johnson"]
    )
    
    return contract


def create_generic_report_contract(title: str = "Report") -> GeneralReportContract:
    """Factory for generic report contracts."""
    contract = GeneralReportContract()
    contract.title = title
    contract.add_section("Overview", f"This is a {title} generated by Clisonix Ocean.")
    return contract


def create_music_contract() -> MusicContract:
    """Factory for music generation contracts."""
    return MusicContract()


def create_painting_contract() -> PaintingContract:
    """Factory for painting/image generation contracts."""
    return PaintingContract()


def create_animation_contract() -> AnimationContract:
    """Factory for animation generation contracts."""
    return AnimationContract()


# Contract registry
CONTRACT_TYPES = {
    "cpi": create_cpi_report_contract,
    "research": create_research_report_contract,
    "generic": create_generic_report_contract,
    "video": lambda: VideoContract(),
    "voice": lambda: VoiceContract(),
    "music": create_music_contract,
    "painting": create_painting_contract,
    "animation": create_animation_contract
}


def get_contract_factory(contract_type: str):
    """Get contract factory by type."""
    return CONTRACT_TYPES.get(contract_type.lower(), create_generic_report_contract)

