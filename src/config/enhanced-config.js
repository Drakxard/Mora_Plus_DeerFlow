// Enhanced configuration for vector temas and chunking
const enhancedConfig = {
  // Chunking settings
  chunking: {
    chunkSize: 500,
    overlap: 50,
    minChunkSize: 50,
  },

  // Vector temas settings
  vectorTemas: {
    similarityThreshold: 0.3,
    maxSuggestions: 5,
    refinementLimit: 3,
  },

  // Eje (axis) definitions
  ejes: [
    "U1-Res. de Problemas",
    "U2-Alg. Computacionales",
    "U3-Est. de Control",
    "U4-Arreglos",
    "U5-Intro Prog.",
    "U6-Intro C++",
    "U7-Est. de Control",
    "U8-Funciones",
    "U9-Arreglos y Structs",
  ],

  // Study modes
  modes: {
    theory: {
      name: "Teoría",
      icon: "📚",
      description: "Conceptos y explicaciones teóricas",
    },
    practice: {
      name: "Práctica",
      icon: "🎯",
      description: "Ejercicios y problemas prácticos",
    },
  },

  // File paths
  paths: {
    contentDir: "content",
    chunksFile: "data/enhanced_chunks.json",
    plansFile: "data/persistent_plans.json",
    embeddingsDir: "embeddings",
  },
}

module.exports = enhancedConfig
