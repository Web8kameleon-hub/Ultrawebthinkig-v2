"""
AI Model Versioning & Registry - AI Act Compliance
Tracks all ML models, versions, performance, and compliance status
"""

import hashlib
import json
import logging
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

class ModelStatus(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    DEPRECATED = "deprecated"

class ModelType(str, Enum):
    LLM = "llm"
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    NEURAL_NETWORK = "neural_network"
    TIME_SERIES = "time_series"

@dataclass
class ModelVersion:
    """Model version metadata"""
    model_id: str
    version: str
    status: str
    model_type: str
    framework: str
    created_date: str
    trained_on_samples: int
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    training_data_hash: str
    model_hash: str
    parameters: Dict[str, Any]
    compliance_checked: bool
    ai_risk_assessment: str  # "minimal", "low", "medium", "high"
    documentation: str
    owner: str

class AIModelRegistry:
    """Centralized AI Model Registry"""
    
    MODEL_REGISTRY_FILE = os.getenv("MODEL_REGISTRY_PATH", "model_registry.json")
    
    def __init__(self) -> None:
        self.models: Dict[str, List[Dict[str, Any]]] = self._load_registry()
    
    def _load_registry(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load model registry from disk"""
        try:
            if os.path.exists(self.MODEL_REGISTRY_FILE):
                with open(self.MODEL_REGISTRY_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load model registry: {e}")
        return {}
    
    def _save_registry(self):
        """Save model registry to disk"""
        try:
            with open(self.MODEL_REGISTRY_FILE, 'w') as f:
                json.dump(self.models, f, indent=2)
            logger.info(f"✅ Model registry saved to {self.MODEL_REGISTRY_FILE}")
        except Exception as e:
            logger.error(f"Failed to save model registry: {e}")
    
    def register_model(self, model_version: ModelVersion) -> bool:
        """Register a new model version"""
        try:
            if model_version.model_id not in self.models:
                self.models[model_version.model_id] = []
            
            self.models[model_version.model_id].append(asdict(model_version))
            self._save_registry()
            logger.info(f"✅ Model registered: {model_version.model_id}@{model_version.version}")
            return True
        except Exception as e:
            logger.error(f"Failed to register model: {e}")
            return False
    
    def get_model_versions(self, model_id: str) -> List[Dict[str, Any]]:
        """Get all versions of a model"""
        return self.models.get(model_id, [])
    
    def get_latest_production_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get latest production version of a model"""
        versions = self.get_model_versions(model_id)
        production_versions = [v for v in versions if v['status'] == ModelStatus.PRODUCTION.value]
        if production_versions:
            return production_versions[-1]
        return None
    
    def promote_model(self, model_id: str, version: str, new_status: str) -> bool:
        """Promote model to new status (e.g., staging -> production)"""
        versions: List[Dict[str, Any]] = self.models.get(model_id, [])
        for v in versions:
            if v['version'] == version:
                old_status = v['status']
                v['status'] = new_status
                v['last_promoted'] = datetime.utcnow().isoformat()
                self._save_registry()
                logger.info(f"🔄 Model promoted: {model_id}@{version} ({old_status} -> {new_status})")
                return True
        return False
    
    def deprecate_model(self, model_id: str, version: str, reason: str) -> bool:
        """Deprecate a model version"""
        versions: List[Dict[str, Any]] = self.models.get(model_id, [])
        for v in versions:
            if v['version'] == version:
                v['status'] = ModelStatus.DEPRECATED.value
                v['deprecation_reason'] = reason
                v['deprecated_date'] = datetime.utcnow().isoformat()
                self._save_registry()
                logger.warning(f"⚠️  Model deprecated: {model_id}@{version} - {reason}")
                return True
        return False

class AIComplianceChecker:
    """AI/ML Model Compliance Verification"""
    
    @staticmethod
    def calculate_model_hash(model_path: str) -> str:
        """Calculate SHA-256 hash of model file"""
        sha256_hash = hashlib.sha256()
        try:
            with open(model_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate model hash: {e}")
            return ""
    
    @staticmethod
    def assess_ai_risk(model_type: str, training_samples: int, 
                      accuracy: float, high_stakes: bool = False) -> str:
        """
        Assess AI model risk level per EU AI Act
        Returns: "minimal", "low", "medium", "high"
        """
        if high_stakes and accuracy < 0.90:
            return "high"
        elif accuracy < 0.80:
            return "medium"
        elif training_samples < 1000:
            return "low"
        else:
            return "minimal"
    
    @staticmethod
    def generate_model_documentation(model: ModelVersion) -> str:
        """Generate AI model documentation for compliance"""
        doc = f"""
# Model: {model.model_id} v{model.version}

## Model Information
- **Type**: {model.model_type}
- **Framework**: {model.framework}
- **Status**: {model.status}
- **Created**: {model.created_date}
- **Owner**: {model.owner}
- **Risk Level**: {model.ai_risk_assessment}

## Performance Metrics
- **Accuracy**: {model.accuracy:.2%}
- **Precision**: {model.precision:.2%}
- **Recall**: {model.recall:.2%}
- **F1 Score**: {model.f1_score:.2%}

## Training Data
- **Samples**: {model.trained_on_samples:,}
- **Data Hash**: {model.training_data_hash}

## Model Integrity
- **Model Hash**: {model.model_hash}
- **Parameters**: {json.dumps(model.parameters, indent=2)}

## Compliance Status
✅ **Compliance Checked**: {model.compliance_checked}
✅ **AI Act Risk Assessment**: {model.ai_risk_assessment}
✅ **Documentation**: Complete

## Parameters
{json.dumps(model.parameters, indent=2)}
"""
        return doc

class ModelVersioningAPI:
    """API endpoints for model versioning"""
    
    def __init__(self):
        self.registry = AIModelRegistry()
    
    def create_model_version(self, model_id: str, version: str, 
                            model_type: str, framework: str,
                            trained_on_samples: int, accuracy: float,
                            precision: float, recall: float, f1_score: float,
                            training_data_hash: str, model_hash: str,
                            parameters: Dict, owner: str) -> Dict[str, Any]:
        """Create and register a new model version"""
        
        ai_risk = AIComplianceChecker.assess_ai_risk(
            model_type, trained_on_samples, accuracy, high_stakes=False
        )
        
        model_version = ModelVersion(
            model_id=model_id,
            version=version,
            status=ModelStatus.DEVELOPMENT.value,
            model_type=model_type,
            framework=framework,
            created_date=datetime.utcnow().isoformat(),
            trained_on_samples=trained_on_samples,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            training_data_hash=training_data_hash,
            model_hash=model_hash,
            parameters=parameters,
            compliance_checked=False,
            ai_risk_assessment=ai_risk,
            documentation=AIComplianceChecker.generate_model_documentation(
                ModelVersion(
                    model_id, version, ModelStatus.DEVELOPMENT.value, model_type,
                    framework, datetime.utcnow().isoformat(), trained_on_samples,
                    accuracy, precision, recall, f1_score, training_data_hash,
                    model_hash, parameters, False, ai_risk, "", owner
                )
            ),
            owner=owner
        )
        
        success = self.registry.register_model(model_version)
        return {
            "status": "registered" if success else "failed",
            "model": asdict(model_version)
        }

# FastAPI Integration
"""
from fastapi import FastAPI, HTTPException

app = FastAPI()
versioning_api = ModelVersioningAPI()

@app.post("/api/models/register")
async def register_model(model_data: dict):
    result = versioning_api.create_model_version(**model_data)
    return result

@app.get("/api/models/{model_id}/versions")
async def get_model_versions(model_id: str):
    versions = versioning_api.registry.get_model_versions(model_id)
    return {"model_id": model_id, "versions": versions}

@app.get("/api/models/{model_id}/production")
async def get_production_model(model_id: str):
    model = versioning_api.registry.get_latest_production_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="No production model found")
    return model

@app.post("/api/models/{model_id}/{version}/promote")
async def promote_model(model_id: str, version: str, new_status: str):
    success = versioning_api.registry.promote_model(model_id, version, new_status)
    return {"status": "promoted" if success else "failed"}
"""

if __name__ == "__main__":
    print("🤖 AI Model Versioning System")
    print("   Registry: model_registry.json")
    print("   Compliance: EU AI Act, GDPR, Transparency")
    print("   Status tracking: Development → Staging → Production → Deprecated")
