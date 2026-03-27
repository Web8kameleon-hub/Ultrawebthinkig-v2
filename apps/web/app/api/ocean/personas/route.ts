/**
 * API Endpoint: /api/ocean/personas
 * Combines Ocean Helpers with 14 Specialist Personas
 * Routes questions through helpers THEN applies persona-specific tone/style
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleQuestion,
  validateQuestion,
  getHelperRegistry,
  type HelperResult,
  type HandleQuestionOptions,
} from '../../../lib/oceanHelpers';

// ============================================================================
// 14 SPECIALIST PERSONAS
// ============================================================================

interface PersonaProfile {
  id: string;
  name: string;
  domain: string;
  tone: string;
  style: string;
  keywords: string[];
  expertise: string;
}

const PERSONAS: Record<string, PersonaProfile> = {
  neuroscience_expert: {
    id: 'neuroscience_expert',
    name: 'Neuroscience Expert',
    domain: 'neuroscience',
    tone: 'Scientific, precise, evidence-based',
    style: 'Explains brain function with anatomical accuracy',
    keywords: ['brain', 'neuron', 'synapse', 'neural', 'consciousness', 'cognitive'],
    expertise: 'Neurobiology, brain science, cognitive systems',
  },
  ai_specialist: {
    id: 'ai_specialist',
    name: 'AI Specialist',
    domain: 'artificial_intelligence',
    tone: 'Technical, forward-thinking, practical',
    style: 'Discusses AI systems, models, and implications',
    keywords: ['ai', 'machine learning', 'neural network', 'algorithm', 'llm', 'model'],
    expertise: 'Artificial Intelligence, machine learning, deep learning',
  },
  data_analyst: {
    id: 'data_analyst',
    name: 'Data Analyst',
    domain: 'data_science',
    tone: 'Analytical, metrics-driven, quantitative',
    style: 'Focuses on data patterns, statistics, insights',
    keywords: ['data', 'analysis', 'statistics', 'metric', 'trend', 'pattern'],
    expertise: 'Data science, statistics, business intelligence',
  },
  systems_engineer: {
    id: 'systems_engineer',
    name: 'Systems Engineer',
    domain: 'engineering',
    tone: 'Practical, systematic, solution-oriented',
    style: 'Breaks down complex systems into components',
    keywords: ['system', 'architecture', 'infrastructure', 'design', 'integration'],
    expertise: 'Systems design, infrastructure, engineering principles',
  },
  security_expert: {
    id: 'security_expert',
    name: 'Security Expert',
    domain: 'cybersecurity',
    tone: 'Cautious, thorough, risk-aware',
    style: 'Identifies vulnerabilities and secure solutions',
    keywords: ['security', 'vulnerability', 'risk', 'attack', 'encryption', 'threat'],
    expertise: 'Cybersecurity, risk management, threat analysis',
  },
  medical_advisor: {
    id: 'medical_advisor',
    name: 'Medical Advisor',
    domain: 'healthcare',
    tone: 'Careful, evidence-based, health-focused',
    style: 'Provides health information with medical context',
    keywords: ['health', 'medical', 'disease', 'treatment', 'patient', 'clinical'],
    expertise: 'Healthcare, medicine, wellness, diagnostics',
  },
  wellness_coach: {
    id: 'wellness_coach',
    name: 'Wellness Coach',
    domain: 'wellness',
    tone: 'Encouraging, holistic, supportive',
    style: 'Offers practical wellbeing and lifestyle advice',
    keywords: ['wellness', 'fitness', 'health', 'exercise', 'mindfulness', 'lifestyle'],
    expertise: 'Physical wellness, mental health, lifestyle optimization',
  },
  creative_director: {
    id: 'creative_director',
    name: 'Creative Director',
    domain: 'creative',
    tone: 'Imaginative, expressive, artistic',
    style: 'Approaches problems with creative and design thinking',
    keywords: ['creative', 'design', 'art', 'innovation', 'visual', 'storytelling'],
    expertise: 'Creative strategy, design, innovation, storytelling',
  },
  performance_optimizer: {
    id: 'performance_optimizer',
    name: 'Performance Optimizer',
    domain: 'optimization',
    tone: 'Results-driven, efficiency-focused, strategic',
    style: 'Focuses on maximizing performance and outcomes',
    keywords: ['performance', 'optimization', 'efficiency', 'improvement', 'accelerate'],
    expertise: 'Performance enhancement, optimization, strategic improvement',
  },
  research_scientist: {
    id: 'research_scientist',
    name: 'Research Scientist',
    domain: 'research',
    tone: 'Inquisitive, methodical, academically rigorous',
    style: 'Explores research methods, findings, and implications',
    keywords: ['research', 'study', 'experiment', 'hypothesis', 'methodology', 'evidence'],
    expertise: 'Scientific research, methodology, evidence analysis',
  },
  business_strategist: {
    id: 'business_strategist',
    name: 'Business Strategist',
    domain: 'business',
    tone: 'Strategic, market-aware, ROI-focused',
    style: 'Analyzes business opportunities and competitive landscape',
    keywords: ['business', 'strategy', 'market', 'roi', 'growth', 'competitive'],
    expertise: 'Business strategy, market analysis, growth',
  },
  technical_writer: {
    id: 'technical_writer',
    name: 'Technical Writer',
    domain: 'documentation',
    tone: 'Clear, structured, audience-aware',
    style: 'Explains technical concepts in understandable ways',
    keywords: ['documentation', 'tutorial', 'guide', 'explanation', 'technical', 'tool'],
    expertise: 'Technical documentation, tutorials, API design',
  },
  ux_specialist: {
    id: 'ux_specialist',
    name: 'UX Specialist',
    domain: 'user_experience',
    tone: 'User-centric, empathetic, practical',
    style: 'Focuses on user needs, experience, and usability',
    keywords: ['user', 'experience', 'ux', 'interface', 'usability', 'design'],
    expertise: 'User experience, interface design, usability',
  },
  ethics_advisor: {
    id: 'ethics_advisor',
    name: 'Ethics Advisor',
    domain: 'ethics',
    tone: 'Thoughtful, balanced, principle-based',
    style: 'Considers ethical implications and values',
    keywords: ['ethics', 'moral', 'principle', 'responsibility', 'impact', 'values'],
    expertise: 'Ethics, philosophy, social responsibility',
  },
};

// ============================================================================
// PERSONA ROUTING
// ============================================================================

function detectPersonaFromQuestion(question: string): PersonaProfile {
  const q = question.toLowerCase();

  for (const [, persona] of Object.entries(PERSONAS)) {
    if (persona.keywords.some((kw) => q.includes(kw))) {
      return persona;
    }
  }

  // Default to research scientist for complex questions
  return PERSONAS.research_scientist;
}

function enhanceAnswerWithPersona(
  helperResult: HelperResult,
  persona: PersonaProfile
): {
  original: HelperResult;
  enhanced: string;
  persona: PersonaProfile;
} {
  const baseAnswer = helperResult.answer;

  // Persona-specific response enhancement
  let enhanced = baseAnswer;

  if (persona.id === 'neuroscience_expert' && helperResult.domain === 'science') {
    enhanced = `[🧠 Neuroscience perspective]\n${baseAnswer}\n\nFrom a neuroscientific viewpoint: This connects to how our brain processes and interprets information through neural mechanisms.`;
  } else if (
    persona.id === 'ai_specialist' &&
    helperResult.domain === 'reasoning'
  ) {
    enhanced = `[🤖 AI Specialist Analysis]\n${baseAnswer}\n\nAI systems approach this through pattern recognition and logical inference similar to human reasoning processes.`;
  } else if (
    persona.id === 'data_analyst' &&
    helperResult.domain === 'math'
  ) {
    enhanced = `[📊 Data-Driven Analysis]\n${baseAnswer}\n\nFrom a statistical perspective: This numerical result represents a data point that can be analyzed for patterns and trends.`;
  } else if (persona.id === 'wellness_coach') {
    enhanced = `[💪 Wellness Perspective]\n${baseAnswer}\n\nThis knowledge supports your journey toward better understanding and wellbeing!`;
  } else if (
    persona.id === 'creative_director' &&
    helperResult.domain === 'reasoning'
  ) {
    enhanced = `[🎨 Creative Perspective]\n${baseAnswer}\n\nCreatively speaking: This opens up new possibilities and ways of thinking about the topic.`;
  } else if (persona.id === 'ethics_advisor') {
    enhanced = `[⚖️ Ethics Consideration]\n${baseAnswer}\n\nEthical dimension: Consider the implications and values at play in this question.`;
  }

  return {
    original: helperResult,
    enhanced,
    persona,
  };
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/ocean/personas
 * Returns registry of all 14 personas
 */
async function handleGetRequest() {
  const helpers = getHelperRegistry();
  const personasList = Object.values(PERSONAS).map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
    tone: p.tone,
    expertise: p.expertise,
  }));

  return NextResponse.json({
    status: 'ok',
    message: 'Ocean Helpers + Personas Engine',
    version: '2.0.0',
    engine: {
      helpers: helpers.supportedDomains,
      helpers_count: helpers.count,
    },
    personas: {
      count: personasList.length,
      list: personasList,
    },
    endpoints: {
      route: 'POST /api/ocean/personas',
      registry: 'GET /api/ocean/personas',
    },
  });
}

/**
 * POST /api/ocean/personas
 * Body: { question: string, persona?: string, debug?: boolean }
 */
async function handlePostRequest(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, persona: requestedPersona, debug = false } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: '"question" field is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Security validation
    const { safe, reason } = validateQuestion(question);
    if (!safe) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: reason,
          blocked: true,
        },
        { status: 403 }
      );
    }

    // Step 1: Get helper response
    const options: HandleQuestionOptions = {
      includeDebug: debug,
      fallbackToReasoning: true,
    };

    const helperResult = await handleQuestion(question, options);

    // Step 2: Detect or use specified persona
    const selectedPersona =
      requestedPersona && PERSONAS[requestedPersona]
        ? PERSONAS[requestedPersona]
        : detectPersonaFromQuestion(question);

    // Step 3: Enhance answer with persona perspective
    const personalized = enhanceAnswerWithPersona(helperResult, selectedPersona);

    return NextResponse.json({
      ok: true,
      helpers: {
        domain: helperResult.domain,
        confidence: helperResult.confidence,
        result: helperResult.answer,
      },
      persona: {
        id: selectedPersona.id,
        name: selectedPersona.name,
        domain: selectedPersona.domain,
        tone: selectedPersona.tone,
      },
      response: personalized.enhanced,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Ocean Personas Error]', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  return handleGetRequest();
}

export async function POST(request: NextRequest) {
  return handlePostRequest(request);
}
