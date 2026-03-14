'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

/**
 * CLISONIX HOME PAGE
 * User-facing tools and modules
 */

const MODULES = [
  // 🌊 AI & CHAT
  {
    id: 'curiosity-ocean',
    name: 'Curiosity Ocean',
    description: 'AI-powered chat interface for exploring knowledge',
    icon: '🌊',
    color: 'from-emerald-500 to-teal-600',
    category: 'AI Chat'
  },
  {
    id: 'web-reader',
    name: 'Web Reader',
    description: 'Browse any webpage, search the web, chat with page content',
    icon: '🌐',
    color: 'from-blue-500 to-cyan-600',
    category: 'AI Chat',
    isNew: true
  },
  {
    id: 'archive',
    name: 'Archive & Research',
    description: 'Search ArXiv, Wikipedia, PubMed and 5000+ global data sources',
    icon: '📜',
    color: 'from-indigo-500 to-violet-600',
    category: 'Research',
    isNew: true
  },
  {
    id: 'social-intelligence',
    name: 'Social Intelligence',
    description: 'Direct social media search for video, photo, figures and status',
    icon: '📡',
    color: 'from-cyan-500 to-blue-600',
    category: 'Research',
    isNew: true
  },
  // 🧠 NEUROSCIENCE
  {
    id: 'eeg-analysis',
    name: 'EEG Analysis',
    description: 'Real-time brainwave pattern analysis',
    icon: '🧠',
    color: 'from-purple-500 to-pink-600',
    category: 'Neuroscience'
  },
  {
    id: 'neural-synthesis',
    name: 'Neural Synthesis',
    description: 'Synthesize neural patterns and waveforms',
    icon: '⚡',
    color: 'from-yellow-500 to-orange-600',
    category: 'Neuroscience'
  },
  // 🔒 PRIVATE - Neural Biofeedback & Neuroacoustic Converter hidden from public access
  // {
  //   id: 'neural-biofeedback',
  //   name: 'Neural Biofeedback',
  //   description: 'Real-time cognitive state monitoring',
  //   icon: '💫',
  //   color: 'from-indigo-500 to-purple-600',
  //   category: 'Neuroscience'
  // },
  // {
  //   id: 'neuroacoustic-converter',
  //   name: 'Neuroacoustic Converter',
  //   description: 'Convert brain signals to audio',
  //   icon: '🎵',
  //   color: 'from-violet-500 to-purple-600',
  //   category: 'Neuroscience'
  // },
  // 📊 USER TOOLS
  {
    id: 'fitness-dashboard',
    name: 'Fitness Dashboard',
    description: 'Health metrics and performance tracking',
    icon: '💪',
    color: 'from-red-500 to-pink-600',
    category: 'Health'
  },
  {
    id: 'weather-dashboard',
    name: 'Weather & Cognitive',
    description: 'How weather impacts cognitive performance',
    icon: '🌤️',
    color: 'from-sky-500 to-teal-600',
    category: 'Environment'
  },
  // 👤 ACCOUNT & DATA
  {
    id: 'account',
    name: 'Account & Billing',
    description: 'Manage your profile, subscriptions, payment methods and settings',
    icon: '👤',
    color: 'from-emerald-500 to-teal-600',
    category: 'Account'
  },
  {
    id: 'my-data-dashboard',
    name: 'My Data Dashboard',
    description: 'IoT devices, API integrations, LoRa/GSM networks',
    icon: '📊',
    color: 'from-green-500 to-teal-600',
    category: 'Data'
  },
  // 👨‍💻 DEVELOPER
  {
    id: 'developer-docs',
    name: 'Developer Documentation',
    description: 'API Reference, SDKs, Quick Start Guide',
    icon: '👨‍💻',
    color: 'from-purple-500 to-pink-600',
    category: 'Developer'
  }
];

export default function HomePage() {
  return <HomePageClient />;
}
