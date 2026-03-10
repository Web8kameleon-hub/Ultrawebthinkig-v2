import { NextResponse } from "next/server";

const LINKEDIN_CANDIDATES = [
  process.env.LINKEDIN_API_URL,
  "http://clisonix-linkedin-poster:8007",
  "http://linkedin-poster:8007",
  "http://localhost:8007",
].filter((url): url is string => Boolean(url && url.trim()));

export async function GET() {
  let lastError = "LinkedIn service unavailable";

  try {
    for (const base of LINKEDIN_CANDIDATES) {
      try {
        const response = await fetch(`${base}/api/linkedin/pending-articles`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          lastError = `Unexpected response type from ${base}`;
          continue;
        }

        const data = await response.json();
        if (response.ok) {
          return NextResponse.json(data);
        }

        lastError = data?.error || data?.detail || `HTTP ${response.status}`;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Unknown request error";
      }
    }
  } catch (error) {
    console.error("Error fetching pending articles:", error);
    lastError =
      error instanceof Error ? error.message : "Unknown request error";
    // Return sample articles if service not available
    return NextResponse.json({
      success: false,
      error: lastError,
      pending: [
        {
          id: "eeg-analysis-intro",
          title: "Introduction to EEG Analysis with AI",
          description:
            "Learn how artificial intelligence is revolutionizing EEG signal processing and brain-computer interfaces.",
          slug: "eeg-analysis-intro",
          category: "EEG Analytics",
          tags: ["EEG", "AI", "BrainTech", "NeuralNetworks"],
        },
        {
          id: "industrial-ai-2026",
          title: "Industrial AI Trends for 2026",
          description:
            "Discover the latest trends in industrial artificial intelligence and how they are transforming manufacturing.",
          slug: "industrial-ai-trends-2026",
          category: "Industrial AI",
          tags: ["IndustrialAI", "Manufacturing", "Industry40", "Automation"],
        },
        {
          id: "fda-compliance-ai",
          title: "FDA Compliance in AI Medical Devices",
          description:
            "A comprehensive guide to navigating FDA regulations for AI-powered medical devices and software.",
          slug: "fda-compliance-ai-medical",
          category: "Compliance",
          tags: ["FDA", "MedicalDevices", "Compliance", "Healthcare"],
        },
        {
          id: "ocean-ai-launch",
          title: "Introducing Curiosity Ocean: Your AI Research Assistant",
          description:
            "Meet Curiosity Ocean, our advanced AI assistant for research, document analysis, and intelligent Q&A.",
          slug: "curiosity-ocean-launch",
          category: "Product",
          tags: ["AI", "ChatBot", "Research", "Productivity"],
        },
        {
          id: "neural-biofeedback",
          title: "Real-time Neural Biofeedback Systems",
          description:
            "How real-time biofeedback is enabling new therapeutic approaches for stress, focus, and mental wellness.",
          slug: "neural-biofeedback-systems",
          category: "EEG Analytics",
          tags: ["Biofeedback", "Neuroscience", "Wellness", "MentalHealth"],
        },
      ],
      count: 5,
    });
  }

  console.error("Error fetching pending articles:", lastError);
  return NextResponse.json({
    success: false,
    error: lastError,
    pending: [
      {
        id: "eeg-analysis-intro",
        title: "Introduction to EEG Analysis with AI",
        description:
          "Learn how artificial intelligence is revolutionizing EEG signal processing and brain-computer interfaces.",
        slug: "eeg-analysis-intro",
        category: "EEG Analytics",
        tags: ["EEG", "AI", "BrainTech", "NeuralNetworks"],
      },
      {
        id: "industrial-ai-2026",
        title: "Industrial AI Trends for 2026",
        description:
          "Discover the latest trends in industrial artificial intelligence and how they are transforming manufacturing.",
        slug: "industrial-ai-trends-2026",
        category: "Industrial AI",
        tags: ["IndustrialAI", "Manufacturing", "Industry40", "Automation"],
      },
      {
        id: "fda-compliance-ai",
        title: "FDA Compliance in AI Medical Devices",
        description:
          "A comprehensive guide to navigating FDA regulations for AI-powered medical devices and software.",
        slug: "fda-compliance-ai-medical",
        category: "Compliance",
        tags: ["FDA", "MedicalDevices", "Compliance", "Healthcare"],
      },
      {
        id: "ocean-ai-launch",
        title: "Introducing Curiosity Ocean: Your AI Research Assistant",
        description:
          "Meet Curiosity Ocean, our advanced AI assistant for research, document analysis, and intelligent Q&A.",
        slug: "curiosity-ocean-launch",
        category: "Product",
        tags: ["AI", "ChatBot", "Research", "Productivity"],
      },
      {
        id: "neural-biofeedback",
        title: "Real-time Neural Biofeedback Systems",
        description:
          "How real-time biofeedback is enabling new therapeutic approaches for stress, focus, and mental wellness.",
        slug: "neural-biofeedback-systems",
        category: "EEG Analytics",
        tags: ["Biofeedback", "Neuroscience", "Wellness", "MentalHealth"],
      },
    ],
    count: 5,
  });
}
