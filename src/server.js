// Servidor adaptativo con BKT integrado
import { createServer } from "http"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { readFileSync, existsSync } from "fs"
import { parse } from "url"
import { callGroqAPI } from "./groqApi.js"
import { StudentManager } from "./model/student-manager.js"

// Manual environment loading with proper quote handling
function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env")
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf8")
      envContent.split("\n").forEach((line) => {
        // Skip comments and empty lines
        if (line.trim().startsWith("#") || !line.trim()) return

        const [key, ...valueParts] = line.split("=")
        if (key && valueParts.length > 0) {
          let value = valueParts.join("=").trim()

          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }

          process.env[key.trim()] = value
        }
      })
      console.log("✅ .env file loaded")

      // Debug GROQ key loading
      if (process.env.GROQ_API_KEY) {
        console.log(`🔑 GROQ API Key loaded: ${process.env.GROQ_API_KEY.substring(0, 15)}...`)
        console.log(`🔑 Key length: ${process.env.GROQ_API_KEY.length} characters`)
        console.log(`🔑 Starts with 'gsk_': ${process.env.GROQ_API_KEY.startsWith("gsk_")}`)
      } else {
        console.log("❌ GROQ_API_KEY not found in environment")
      }
    } else {
      console.log("⚠️ No .env file found")
    }
  } catch (error) {
    console.log("⚠️ Error loading .env:", error.message)
  }
}

// Load environment first
loadEnv()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PORT = process.env.PORT || 3000

// Initialize Student Manager
const studentManager = new StudentManager()

// Temporary fallback until StudentManager is created
// const studentManager = {
//   getStudentMastery: () => ({}),
//   getAdaptiveRecommendations: () => [],
//   generateAdaptiveQuiz: () => ({
//     targetTopic: "general",
//     adaptiveLevel: "intermediate",
//     currentMastery: 50,
//     recommendation: { message: "Continue practicing" }
//   }),
//   createPersonalizedPlan: () => ({
//     schedule: [],
//     goals: []
//   }),
//   getStudentDashboard: () => ({
//     dashboard: { overall: {} },
//     profileAge: 0
//   }),
//   getStudentEngine: () => ({ sessionHistory: [] }),
//   processStudentInteraction: () => ({}),
//   getAllStudentsSummary: () => ({
//     totalStudents: 0,
//     students: [],
//     globalStats: {}
//   })
// }

// Load real chunks from embeddings/index.json
let realChunks = []
let embeddings = []
let indexMetadata = {}

function loadRealChunks() {
  try {
    const indexPath = join(process.cwd(), "embeddings", "index.json")
    console.log(`🔍 Looking for embeddings at: ${indexPath}`)

    if (existsSync(indexPath)) {
      const indexData = JSON.parse(readFileSync(indexPath, "utf8"))
      console.log("📄 Index file structure:", Object.keys(indexData))

      // Handle different possible structures
      if (indexData.chunks_metadata && Array.isArray(indexData.chunks_metadata)) {
        // New structure with chunks_metadata
        realChunks = indexData.chunks_metadata
        console.log(`✅ Loaded ${realChunks.length} chunks from chunks_metadata`)
      } else if (indexData.texts && Array.isArray(indexData.texts)) {
        // Structure with texts array
        realChunks = indexData.texts.map((text, i) => ({
          text: text,
          chunk_id: `chunk_${i}`,
          source: `document_${i}`,
          length: text.length,
        }))
        console.log(`✅ Loaded ${realChunks.length} chunks from texts array`)
      } else if (Array.isArray(indexData)) {
        // Direct array of chunks
        realChunks = indexData
        console.log(`✅ Loaded ${realChunks.length} chunks from direct array`)
      } else {
        console.log("⚠️ Unknown index structure:", indexData)
        return false
      }

      // Load embeddings if available
      if (indexData.embeddings && Array.isArray(indexData.embeddings)) {
        embeddings = indexData.embeddings
        console.log(`✅ Loaded ${embeddings.length} embeddings`)
      }

      // Load metadata
      indexMetadata = indexData.metadata || {}
      console.log(`📊 Metadata:`, indexMetadata.processing_stats || "No stats available")

      return true
    } else {
      console.log("❌ No embeddings/index.json found - REAL CHUNKS REQUIRED")
      return false
    }
  } catch (error) {
    console.log("❌ Error loading real chunks:", error.message)
    console.log("Stack:", error.stack)
    return false
  }
}

// Initialize chunks - ONLY REAL CHUNKS
const hasRealChunks = loadRealChunks()
const chunks = hasRealChunks ? realChunks : []

if (chunks.length === 0) {
  console.log("❌ NO CHUNKS AVAILABLE - Please run embeddings generation first")
  console.log("📝 Run: python scripts/chunk_and_embed.py")
  process.exit(1)
}

console.log(`📚 Final chunks count: ${chunks.length}`)
if (chunks.length > 0) {
  console.log(`📝 Sample chunk:`, chunks[0])
}

// Progress tracking utilities
function logProgress(operation, step, total, message) {
  const percentage = Math.round((step / total) * 100)
  const progressBar = "█".repeat(Math.floor(percentage / 5)) + "░".repeat(20 - Math.floor(percentage / 5))
  console.log(`🔄 ${operation} [${progressBar}] ${percentage}% - ${message}`)
}

function searchChunks(query, limit = 3, adaptiveLevel = "intermediate") {
  const startTime = Date.now()
  console.log(`🔍 Starting adaptive search for: "${query}" (level: ${adaptiveLevel})`)

  if (!query || query.trim().length === 0) {
    return { results: [], total: 0, query }
  }

  const queryLower = query.toLowerCase()
  const words = queryLower.split(" ").filter((w) => w.length > 0)

  console.log(`📊 Search parameters: ${words.length} words, ${chunks.length} chunks to search`)
  logProgress("SEARCH", 1, 4, "Analyzing query")

  const results = chunks
    .map((chunk, index) => {
      // Progress every 100 chunks
      if (index % 100 === 0) {
        logProgress("SEARCH", 2, 4, `Processing chunk ${index}/${chunks.length}`)
      }

      // Extract text from different possible fields
      const chunkText = (chunk.text || chunk.content || chunk.chunk_text || JSON.stringify(chunk)).toLowerCase()

      let score = 0

      // 1. Exact phrase match (highest priority)
      if (chunkText.includes(queryLower)) {
        score += 10
      }

      // 2. All words present (high priority)
      const allWordsPresent = words.every((word) => chunkText.includes(word))
      if (allWordsPresent) {
        score += 8
      }

      // 3. Individual word matches
      words.forEach((word) => {
        const wordCount = (chunkText.match(new RegExp(word, "g")) || []).length
        score += wordCount * 2
      })

      // 4. Partial word matches (for short queries like "fs")
      words.forEach((word) => {
        if (word.length >= 2) {
          // Look for words that start with the query
          const startsWithPattern = new RegExp(`\\b${word}`, "g")
          const startsWithMatches = (chunkText.match(startsWithPattern) || []).length
          score += startsWithMatches * 1.5

          // Look for words that contain the query
          const containsPattern = new RegExp(word, "g")
          const containsMatches = (chunkText.match(containsPattern) || []).length
          score += containsMatches * 0.5
        }
      })

      // 5. Fuzzy matching for common terms
      const fuzzyMatches = {
        fs: ["función", "funciones"],
        plano: ["plano", "planos", "geometría", "espacio"],
        recta: ["recta", "rectas", "línea", "líneas"],
        pendiente: ["pendiente", "pendientes", "inclinación", "slope"],
        algebra: ["álgebra", "algebraico", "ecuación", "ecuaciones"],
        calculo: ["cálculo", "derivada", "integral", "límite"],
        geometria: ["geometría", "geométrico", "figura", "figuras"],
      }

      words.forEach((word) => {
        if (fuzzyMatches[word]) {
          fuzzyMatches[word].forEach((fuzzyWord) => {
            if (chunkText.includes(fuzzyWord)) {
              score += 3
            }
          })
        }
      })

      // 6. ADAPTIVE FILTERING based on level
      const chunkLength = chunkText.length
      if (adaptiveLevel === "beginner" && chunkLength > 300) {
        score *= 0.7 // Prefer shorter, simpler content
      } else if (adaptiveLevel === "advanced" && chunkLength < 150) {
        score *= 0.8 // Prefer more detailed content
      }

      return {
        ...chunk,
        score,
        text: chunk.text || chunk.content || chunk.chunk_text || "No text available",
        preview: (chunk.text || chunk.content || chunk.chunk_text || "").substring(0, 200) + "...",
        adaptiveLevel,
      }
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  logProgress("SEARCH", 3, 4, "Ranking results")

  const searchTime = Date.now() - startTime
  logProgress("SEARCH", 4, 4, `Completed in ${searchTime}ms`)

  console.log(`📊 Adaptive search results: ${results.length} chunks found in ${searchTime}ms`)
  results.forEach((result, i) => {
    console.log(
      `   ${i + 1}. Score: ${result.score}, Source: ${result.source}, Preview: ${result.preview.substring(0, 100)}...`,
    )
  })

  return {
    results,
    total: results.length,
    query,
    totalChunks: chunks.length,
    searchTime,
    adaptiveLevel,
  }
}

async function generateAdaptiveRAGResponse(question, studentId = "anonymous") {
  const startTime = Date.now()
  try {
    console.log(`💬 Processing adaptive question for student ${studentId}: "${question}"`)
    logProgress("ADAPTIVE_RAG", 1, 6, "Starting adaptive RAG pipeline")

    // Get student's adaptive level
    const studentMastery = studentManager.getStudentMastery(studentId)
    const recommendations = studentManager.getAdaptiveRecommendations(studentId)

    // Determine adaptive level for content selection
    let adaptiveLevel = "intermediate" // default
    if (Object.keys(studentMastery).length > 0) {
      const avgMastery =
        Object.values(studentMastery).reduce((sum, topic) => sum + topic.level, 0) / Object.keys(studentMastery).length
      if (avgMastery < 40) adaptiveLevel = "beginner"
      else if (avgMastery > 70) adaptiveLevel = "advanced"
    }

    logProgress("ADAPTIVE_RAG", 2, 6, `Student level: ${adaptiveLevel}`)

    // Step 1: Adaptive search
    const searchResults = searchChunks(question, 5, adaptiveLevel)
    logProgress("ADAPTIVE_RAG", 3, 6, `Found ${searchResults.total} relevant chunks`)

    if (searchResults.results.length === 0) {
      return {
        response: `No encontré información relevante sobre "${question}" en tu contenido indexado.

📊 **Estado del contenido:**
- Total de fragmentos: ${chunks.length}
- Fuentes disponibles: ${indexMetadata.processing_stats?.total_sources || "Desconocido"}
- Tu nivel actual: ${adaptiveLevel}

💡 **Sugerencias adaptativas:**
- Prueba con términos más básicos si eres principiante
- Usa conceptos más específicos si tienes experiencia

🔍 **Términos que podrían funcionar:** matemáticas, álgebra, geometría, cálculo, funciones, ecuaciones`,
        chunks_used: 0,
        source: "Contenido real adaptativo",
        studentLevel: adaptiveLevel,
        debug: {
          totalChunks: chunks.length,
          searchQuery: question,
          hasRealChunks,
        },
      }
    }

    // Step 2: Build adaptive context
    logProgress("ADAPTIVE_RAG", 4, 6, "Building adaptive context")
    const context = searchResults.results
      .map((chunk, i) => `[Fragmento ${i + 1} - ${chunk.source}]: ${chunk.text}`)
      .join("\n\n")

    // Step 3: Check GROQ API
    const hasGroqAPI = !!process.env.GROQ_API_KEY
    logProgress("ADAPTIVE_RAG", 5, 6, `GROQ API ${hasGroqAPI ? "available" : "not configured"}`)

    if (!hasGroqAPI) {
      const bestChunk = searchResults.results[0]
      return {
        response: `Encontré información relevante para tu nivel (${adaptiveLevel}):

**${bestChunk.source}**
${bestChunk.text}

📊 **Fragmentos consultados:** ${searchResults.results.length}
🎯 **Adaptado para:** ${adaptiveLevel}

⚠️ Para respuestas más inteligentes, configura GROQ_API_KEY en tu archivo .env`,
        chunks_used: searchResults.results.length,
        source: "Contenido real adaptativo",
        studentLevel: adaptiveLevel,
      }
    }

    // Step 4: Generate adaptive AI response LUEGO CARGAR PROMT SYSTEM -> TUTOR EN PARTICULAR

      const adaptivePrompt = `Eres un tutor experto en Fundamentos de Programación. TU MISIÓN es generar enunciados de ejercicios para Segundo Parcial o Final con un estilo profesional, adecuados para una clase de 3 horas, escritos pensando en papel y lápiz, que exijan análisis profundo y contengan “trampas” sutiles para desafiar al estudiante.
Index a usar como profesor -> Leer, Dato N, Mientras sea, Repetir, Hasta que, Si, Sino, Insertar.
1. CUATRO EJES TEMÁTICOS  
   - Selecciona 4 ejes relevantes del contexto provisto.

2. ENUNCIADOS DE EJERCICIOS  
   - Para cada eje, crea un ejercicio numerado como EjN (30 pts):  
 
     Ej1 (30 pts)
   - El enunciado debe:  
     - Pensarse como un reto de **papel y lápiz** (sin código a ejecutar).  
     - Requerir **análisis detallado** y comprensión de varios conceptos combinados.  
     - Incluir al menos una “trampa” sutil que, sin reflexión, sea fácil pasar por alto.

3. REGLAS  
   - Basa los ejes en ${context} pero genera enunciados **totalmente nuevos** y de **alta dificultad**.  
   - Ajusta la complejidad al nivel ${adaptiveLevel}.  
   - Responde en español, con tono **educativo**, **claro** y **conciso**.  
   - No agregues secciones ni explicaciones adicionales fuera del formato.

–––

NIVEL DEL ESTUDIANTE: ${adaptiveLevel}  
CONTEXTO RELEVANTE:  
${context}  

PREGUNTA DEL ESTUDIANTE: "${question}"  

RESPUESTA FORMATEADA:`;

      console.log("🤖 Calling GROQ API with adaptive prompt...");
      const aiResponse = await callGroqAPI(adaptivePrompt);

    const totalTime = Date.now() - startTime
    logProgress("ADAPTIVE_RAG", 6, 6, `Completed in ${totalTime}ms`)

    return {
      response:
        aiResponse +
        `\n\n📊 **Fragmentos consultados:** ${searchResults.results.length}\n🎯 **Adaptado para nivel:** ${adaptiveLevel}`,
      chunks_used: searchResults.results.length,
      source: "🤖 IA + Contenido real adaptativo",
      processingTime: totalTime,
      studentLevel: adaptiveLevel,
      recommendations: recommendations.length > 0 ? recommendations.slice(0, 2) : null,
    }
  } catch (error) {
    console.error("❌ Adaptive RAG Error:", error)

    // Fallback with chunks
    const searchResults = searchChunks(question, 1)
    if (searchResults.results.length > 0) {
      const bestChunk = searchResults.results[0]
      return {
        response: `Error con la API de GROQ: ${error.message}

Información encontrada en tu contenido:
**${bestChunk.source}**
${bestChunk.text}

📊 **Fragmentos consultados:** ${searchResults.results.length}`,
        chunks_used: searchResults.results.length,
        source: "📚 Contenido real (Fallback)",
      }
    }

    return {
      response: `Error procesando la consulta: ${error.message}

📊 **Estado:** ${chunks.length} fragmentos disponibles`,
      chunks_used: 0,
      source: "❌ Error",
    }
  }
}

function getSuggestions(query) {
  const suggestions = {
    fs: "funciones, función",
    plano: "geometría, espacio, coordenadas",
    recta: "línea, pendiente, ecuación",
    algebra: "ecuaciones, variables, expresiones",
    calculo: "derivadas, integrales, límites",
  }

  const queryLower = query.toLowerCase()
  for (const [key, value] of Object.entries(suggestions)) {
    if (queryLower.includes(key)) {
      return value
    }
  }

  return "conceptos relacionados, términos similares"
}

// Parse JSON body
async function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })
}

// HTTP Server
const server = createServer(async (req, res) => {
  const { pathname, query } = parse(req.url, true)

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  try {
    // Routes
    if (pathname === "/") {
      // Serve main HTML
      const htmlPath = join(__dirname, "ui", "index.html")
      if (existsSync(htmlPath)) {
        const html = readFileSync(htmlPath, "utf8")
        res.setHeader("Content-Type", "text/html")
        res.writeHead(200)
        res.end(html)
      } else {
        res.writeHead(404)
        res.end("HTML file not found")
      }
    } else if (pathname === "/api") {
      // API status with student stats
      const studentsSummary = studentManager.getAllStudentsSummary()

      const response = {
        name: "Mora + DeerFlow Adaptive API",
        version: "2.0.0",
        status: "running",
        groq_api_key: !!process.env.GROQ_API_KEY,
        groq_key_valid: process.env.GROQ_API_KEY?.startsWith("gsk_") || false,
        adaptive_features: {
          bkt_modeling: true,
          personalized_content: true,
          progress_tracking: true,
          adaptive_difficulty: true,
        },
        content_stats: {
          total_chunks: chunks.length,
          using_real_chunks: hasRealChunks,
          sample_chunk: chunks[0]?.text?.substring(0, 100) + "..." || "No chunks available",
          sources: indexMetadata.processing_stats?.total_sources || "Unknown",
          avg_length: indexMetadata.processing_stats?.avg_chunk_length || "Unknown",
        },
        student_stats: studentsSummary,
        timestamp: new Date().toISOString(),
      }

      res.setHeader("Content-Type", "application/json")
      res.writeHead(200)
      res.end(JSON.stringify(response, null, 2))
    } else if (pathname === "/api/chat" && req.method === "POST") {
      // Adaptive Chat endpoint
      try {
        const body = await parseJSON(req)
        const { message, studentId = "anonymous" } = body

        if (!message || message.trim().length === 0) {
          res.setHeader("Content-Type", "application/json")
          res.writeHead(400)
          res.end(JSON.stringify({ error: "Message is required" }))
          return
        }

        console.log(`💬 Adaptive chat request from ${studentId}: "${message}"`)
        const result = await generateAdaptiveRAGResponse(message.trim(), studentId)

        res.setHeader("Content-Type", "application/json")
        res.writeHead(200)
        res.end(JSON.stringify(result))
      } catch (error) {
        console.error("❌ Adaptive chat endpoint error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Adaptive chat failed", details: error.message }))
      }
    } else if (pathname === "/api/quiz" && req.method === "POST") {
      // Adaptive Quiz endpoint
      const startTime = Date.now()
      try {
        const body = await parseJSON(req)
        const { message, studentId = "anonymous", questionCount = 3 } = body

        console.log(`🎯 Adaptive quiz request from ${studentId}: "${message || "general"}"`)
        logProgress("ADAPTIVE_QUIZ", 1, 8, "Starting adaptive quiz generation")

        // Generate adaptive quiz configuration
        const quizConfig = studentManager.generateAdaptiveQuiz(studentId, message, questionCount)
        logProgress("ADAPTIVE_QUIZ", 2, 8, `Target topic: ${quizConfig.targetTopic} (${quizConfig.adaptiveLevel})`)

        // Search for content at appropriate level
        const searchResults = searchChunks(quizConfig.targetTopic, 3, quizConfig.adaptiveLevel)
        logProgress("ADAPTIVE_QUIZ", 3, 8, `Found ${searchResults.results.length} level-appropriate chunks`)

        if (searchResults.results.length === 0) {
          res.setHeader("Content-Type", "application/json")
          res.writeHead(200)
          res.end(
            JSON.stringify({
              response: `🎯 No encontré contenido suficiente para generar un quiz de nivel ${quizConfig.adaptiveLevel} sobre "${quizConfig.targetTopic}". 

📊 **Tu nivel actual:** ${quizConfig.adaptiveLevel} (${quizConfig.currentMastery}% dominio)

💡 **Sugerencias:** Prueba con temas más básicos o específicos`,
              chunks_used: 0,
              source: "Sistema adaptativo",
              studentLevel: quizConfig.adaptiveLevel,
            }),
          )
          return
        }

        logProgress("ADAPTIVE_QUIZ", 4, 8, "Building adaptive quiz prompt")

        // Generate adaptive quiz prompt
        const adaptiveQuizPrompt = `Basándote en el siguiente contenido educativo, genera un quiz de ${questionCount} preguntas de opción múltiple para un estudiante de nivel ${quizConfig.adaptiveLevel}:

NIVEL DEL ESTUDIANTE: ${quizConfig.adaptiveLevel}
DOMINIO ACTUAL: ${quizConfig.currentMastery}%
TEMA OBJETIVO: ${quizConfig.targetTopic}

CONTENIDO:
${searchResults.results.map((chunk) => chunk.text).join("\n\n")}

INSTRUCCIONES ADAPTATIVAS:
1. Crea ${questionCount} preguntas de opción múltiple (A, B, C, D)
2. Adapta la dificultad al nivel ${quizConfig.adaptiveLevel}:
   - Beginner: Preguntas conceptuales básicas, definiciones
   - Intermediate: Aplicaciones directas, procedimientos
   - Advanced: Análisis, síntesis, problemas complejos
3. Las preguntas deben evaluar comprensión apropiada para el nivel
4. Incluye la respuesta correcta al final
5. Usa un formato claro y educativo

FORMATO:
**Pregunta 1:** [pregunta adaptada al nivel ${quizConfig.adaptiveLevel}]
A) [opción]
B) [opción] 
C) [opción]
D) [opción]

[Repetir para ${questionCount} preguntas]

**Respuestas:** 1-A, 2-B, 3-C (ejemplo)

QUIZ ADAPTATIVO:`

        if (process.env.GROQ_API_KEY) {
          try {
            logProgress("ADAPTIVE_QUIZ", 5, 8, "Generating adaptive questions with AI")
            const quizResponse = await callGroqAPI(adaptiveQuizPrompt)

            logProgress("ADAPTIVE_QUIZ", 6, 8, "Processing quiz for evaluation")

            // TODO: Here we would parse the quiz and prepare for automatic evaluation
            // For now, we'll return the quiz as-is

            logProgress("ADAPTIVE_QUIZ", 7, 8, "Formatting adaptive quiz response")
            const totalTime = Date.now() - startTime
            logProgress("ADAPTIVE_QUIZ", 8, 8, `Adaptive quiz completed in ${totalTime}ms`)

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: `🎯 **Quiz Adaptativo Generado** (${totalTime}ms)

**Nivel:** ${quizConfig.adaptiveLevel} | **Dominio actual:** ${quizConfig.currentMastery}%
**Tema:** ${quizConfig.targetTopic}

${quizResponse}

📊 **Basado en:** ${searchResults.results.length} fragmentos de tu contenido
🎯 **Recomendación:** ${quizConfig.recommendation.message}`,
                chunks_used: searchResults.results.length,
                source: "🤖 IA + Contenido real adaptativo",
                processingTime: totalTime,
                quizConfig,
                studentLevel: quizConfig.adaptiveLevel,
              }),
            )
          } catch (error) {
            logProgress("ADAPTIVE_QUIZ", 6, 8, "AI failed, generating simple adaptive quiz")
            const totalTime = Date.now() - startTime
            logProgress("ADAPTIVE_QUIZ", 8, 8, `Simple adaptive quiz completed in ${totalTime}ms`)

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: `🎯 **Quiz Adaptativo Simple** (${totalTime}ms)

**Tu nivel:** ${quizConfig.adaptiveLevel} (${quizConfig.currentMastery}% dominio)
**Tema:** ${quizConfig.targetTopic}

Basado en tu contenido sobre: ${searchResults.results[0].source}

**Pregunta adaptada a tu nivel:** ¿Cuál es el concepto principal explicado en este fragmento?

**Contenido:** ${searchResults.results[0].text.substring(0, 200)}...

🎯 **Recomendación:** ${quizConfig.recommendation.message}
💡 Configura GROQ_API_KEY para quizzes más avanzados`,
                chunks_used: searchResults.results.length,
                source: "📚 Contenido real adaptativo",
                processingTime: totalTime,
                quizConfig,
                studentLevel: quizConfig.adaptiveLevel,
              }),
            )
          }
        } else {
          logProgress("ADAPTIVE_QUIZ", 5, 8, "No AI available, generating basic adaptive quiz")
          const totalTime = Date.now() - startTime
          logProgress("ADAPTIVE_QUIZ", 8, 8, `Basic adaptive quiz completed in ${totalTime}ms`)

          res.setHeader("Content-Type", "application/json")
          res.writeHead(200)
          res.end(
            JSON.stringify({
              response: `🎯 **Quiz Básico Adaptativo** (${totalTime}ms)

**Tu nivel:** ${quizConfig.adaptiveLevel} (${quizConfig.currentMastery}% dominio)
**Tema:** ${quizConfig.targetTopic}

Basado en: ${searchResults.results[0].source}

**Pregunta:** ¿Cuál es el concepto principal?

**Contenido:** ${searchResults.results[0].text.substring(0, 200)}...

🎯 **Recomendación:** ${quizConfig.recommendation.message}
💡 Configura GROQ_API_KEY para quizzes automáticos`,
              chunks_used: searchResults.results.length,
              source: "📚 Contenido real adaptativo",
              processingTime: totalTime,
              quizConfig,
              studentLevel: quizConfig.adaptiveLevel,
            }),
          )
        }
      } catch (error) {
        console.error("❌ Adaptive quiz error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Adaptive quiz failed", details: error.message }))
      }
    } else if (pathname === "/api/plan" && req.method === "POST") {
      // Personalized Plan endpoint
      const startTime = Date.now()
      try {
        const body = await parseJSON(req)
        const { message, studentId = "anonymous", duration = 7, dailyTime = 30 } = body

        console.log(`📚 Personalized plan request from ${studentId}: "${message || "general"}"`)
        logProgress("PERSONALIZED_PLAN", 1, 6, "Starting personalized plan generation")

        // Generate personalized study plan
        logProgress("PERSONALIZED_PLAN", 2, 6, "Analyzing student progress")
        const personalizedPlan = studentManager.createPersonalizedPlan(studentId, duration, dailyTime)

        logProgress(
          "PERSONALIZED_PLAN",
          3,
          6,
          `Created ${duration}-day plan with ${personalizedPlan.schedule.length} activities`,
        )

        // Get student dashboard for context
        const dashboard = studentManager.getStudentDashboard(studentId)

        logProgress("PERSONALIZED_PLAN", 4, 6, "Building plan presentation")

        const planPrompt = `Basándote en el plan de estudio personalizado, crea una presentación clara y motivadora:

DATOS DEL ESTUDIANTE:
- ID: ${studentId}
- Temas dominados: ${Object.keys(dashboard.dashboard.overall?.distribution || {}).length}
- Nivel promedio: ${dashboard.dashboard.overall?.overallMastery ? Math.round(dashboard.dashboard.overall.overallMastery * 100) : 0}%

PLAN PERSONALIZADO:
${JSON.stringify(personalizedPlan, null, 2)}

SOLICITUD: ${message || "Plan de estudio personalizado"}

INSTRUCCIONES:
1. Presenta el plan de forma clara y motivadora
2. Explica por qué cada actividad está programada
3. Incluye consejos específicos basados en el progreso del estudiante
4. Usa un formato atractivo y fácil de seguir

FORMATO:
📚 **Plan de Estudio Personalizado**

**Tu perfil:**
- [Resumen del nivel actual]

**Plan de ${duration} días:**
[Desglose día por día con explicaciones]

**Objetivos de aprendizaje:**
[Metas específicas]

**Consejos personalizados:**
[Recomendaciones basadas en tu progreso]

PLAN PERSONALIZADO:`

        if (process.env.GROQ_API_KEY) {
          try {
            logProgress("PERSONALIZED_PLAN", 5, 6, "Generating personalized plan with AI")
            const planResponse = await callGroqAPI(planPrompt)

            const totalTime = Date.now() - startTime
            logProgress("PERSONALIZED_PLAN", 6, 6, `Personalized plan completed in ${totalTime}ms`)

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: `${planResponse}\n\n📊 **Plan basado en:** Tu progreso personal (${dashboard.profileAge} días de actividad)\n⏱️ **Generado en:** ${totalTime}ms`,
                chunks_used: personalizedPlan.schedule.length,
                source: "🤖 IA + Progreso personal",
                processingTime: totalTime,
                personalizedPlan,
                studentDashboard: dashboard,
              }),
            )
          } catch (error) {
            logProgress("PERSONALIZED_PLAN", 5, 6, "AI failed, generating simple personalized plan")
            const totalTime = Date.now() - startTime
            logProgress("PERSONALIZED_PLAN", 6, 6, `Simple personalized plan completed in ${totalTime}ms`)

            // Format plan manually
            let planText = `📚 **Plan de Estudio Personalizado** (${totalTime}ms)\n\n`
            planText += `**Tu perfil:** ${dashboard.profileAge} días de actividad\n\n`

            personalizedPlan.schedule.forEach((day, index) => {
              planText += `**Día ${day.day}** - Enfoque: ${day.focus}\n`
              day.activities.forEach((activity) => {
                planText += `  • ${activity.description} (${activity.time} min)\n`
              })
              planText += `\n`
            })

            planText += `**Objetivos:**\n`
            personalizedPlan.goals.forEach((goal) => {
              planText += `  • ${goal.description}: ${goal.current} → ${goal.target}\n`
            })

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: planText + `\n💡 Configura GROQ_API_KEY para planes más detallados`,
                chunks_used: personalizedPlan.schedule.length,
                source: "📚 Progreso personal",
                processingTime: totalTime,
                personalizedPlan,
                studentDashboard: dashboard,
              }),
            )
          }
        } else {
          logProgress("PERSONALIZED_PLAN", 5, 6, "No AI available, generating basic personalized plan")
          const totalTime = Date.now() - startTime
          logProgress("PERSONALIZED_PLAN", 6, 6, `Basic personalized plan completed in ${totalTime}ms`)

          // Simple plan format
          let planText = `📚 **Plan Personalizado** (${totalTime}ms)\n\n`
          planText += `**Tu progreso:** ${dashboard.profileAge} días activo\n\n`

          personalizedPlan.schedule.slice(0, 3).forEach((day) => {
            planText += `**Día ${day.day}:** ${day.focus} (${day.totalTime} min)\n`
          })

          planText += `\n**Objetivos principales:**\n`
          personalizedPlan.goals.slice(0, 2).forEach((goal) => {
            planText += `• ${goal.description}\n`
          })

          res.setHeader("Content-Type", "application/json")
          res.writeHead(200)
          res.end(
            JSON.stringify({
              response: planText + `\n💡 Configura GROQ_API_KEY para planes detallados`,
              chunks_used: personalizedPlan.schedule.length,
              source: "📚 Progreso personal",
              processingTime: totalTime,
              personalizedPlan,
              studentDashboard: dashboard,
            }),
          )
        }
      } catch (error) {
        console.error("❌ Personalized plan error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Personalized plan failed", details: error.message }))
      }
    } else if (pathname === "/api/agents" && req.method === "POST") {
      // Student Progress Analysis endpoint
      const startTime = Date.now()
      try {
        const body = await parseJSON(req)
        const { message, studentId = "anonymous" } = body

        console.log(`🤖 Progress analysis request from ${studentId}: "${message || "general analysis"}"`)
        logProgress("PROGRESS_ANALYSIS", 1, 7, "Starting comprehensive progress analysis")

        // Get comprehensive student data
        logProgress("PROGRESS_ANALYSIS", 2, 7, "Gathering student data")
        const dashboard = studentManager.getStudentDashboard(studentId)
        const mastery = studentManager.getStudentMastery(studentId)
        const recommendations = studentManager.getAdaptiveRecommendations(studentId)

        logProgress("PROGRESS_ANALYSIS", 3, 7, `Analyzing ${Object.keys(mastery).length} topics`)

        // Analyze learning patterns
        const engine = studentManager.getStudentEngine(studentId)
        const recentSessions = engine.sessionHistory.slice(-10)

        logProgress("PROGRESS_ANALYSIS", 4, 7, `Processing ${recentSessions.length} recent sessions`)

        const analysisPrompt = `Actúa como un agente de análisis académico especializado. Analiza el progreso detallado del estudiante:

PERFIL DEL ESTUDIANTE:
- ID: ${studentId}
- Días activo: ${dashboard.profileAge}
- Temas estudiados: ${Object.keys(mastery).length}

DOMINIO POR TEMAS:
${Object.entries(mastery)
  .map(([topic, data]) => `- ${topic}: ${data.level}% (${data.attempts} intentos, ${data.accuracy}% precisión)`)
  .join("\n")}

PROGRESO RECIENTE:
${recentSessions
  .map(
    (session) =>
      `- ${session.topic}: ${session.isCorrect ? "✅" : "❌"} (${Math.round(session.mastery * 100)}% dominio)`,
  )
  .join("\n")}

DASHBOARD COMPLETO:
${JSON.stringify(dashboard.dashboard, null, 2)}

SOLICITUD: ${message || "Análisis completo de progreso"}

INSTRUCCIONES:
1. Analiza patrones de aprendizaje y fortalezas/debilidades
2. Identifica tendencias en el progreso
3. Evalúa la efectividad del estudio actual
4. Proporciona recomendaciones específicas y accionables
5. Sugiere estrategias de mejora personalizadas

FORMATO:
🤖 **Análisis Completo de Progreso Académico**

**Resumen del Perfil:**
- [Evaluación general]

**Análisis de Fortalezas:**
- [Áreas donde destaca]

**Áreas de Oportunidad:**
- [Temas que necesitan atención]

**Patrones de Aprendizaje:**
- [Tendencias identificadas]

**Recomendaciones Estratégicas:**
- [Acciones específicas para mejorar]

**Plan de Acción Inmediato:**
- [Próximos pasos concretos]

ANÁLISIS DETALLADO:`

        if (process.env.GROQ_API_KEY) {
          try {
            logProgress("PROGRESS_ANALYSIS", 5, 7, "Generating AI-powered analysis")
            const analysisResponse = await callGroqAPI(analysisPrompt)

            logProgress("PROGRESS_ANALYSIS", 6, 7, "Formatting comprehensive report")
            const totalTime = Date.now() - startTime
            logProgress("PROGRESS_ANALYSIS", 7, 7, `Progress analysis completed in ${totalTime}ms`)

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: `${analysisResponse}\n\n📊 **Análisis basado en:**\n- ${Object.keys(mastery).length} temas estudiados\n- ${recentSessions.length} sesiones recientes\n- ${dashboard.profileAge} días de actividad\n\n⏱️ **Tiempo de análisis:** ${totalTime}ms`,
                chunks_used: Object.keys(mastery).length + recentSessions.length,
                source: "🤖 Agente IA + Progreso personal",
                processingTime: totalTime,
                studentDashboard: dashboard,
                masteryData: mastery,
                recommendations,
              }),
            )
          } catch (error) {
            logProgress("PROGRESS_ANALYSIS", 6, 7, "AI failed, generating basic analysis")
            const totalTime = Date.now() - startTime
            logProgress("PROGRESS_ANALYSIS", 7, 7, `Basic analysis completed in ${totalTime}ms`)

            // Generate basic analysis
            const topicsCount = Object.keys(mastery).length
            const avgMastery =
              topicsCount > 0 ? Object.values(mastery).reduce((sum, topic) => sum + topic.level, 0) / topicsCount : 0
            const recentAccuracy =
              recentSessions.length > 0
                ? (recentSessions.filter((s) => s.isCorrect).length / recentSessions.length) * 100
                : 0

            let analysisText = `🤖 **Análisis de Progreso** (${totalTime}ms)\n\n`
            analysisText += `**Tu perfil:**\n`
            analysisText += `- ${dashboard.profileAge} días de actividad\n`
            analysisText += `- ${topicsCount} temas estudiados\n`
            analysisText += `- ${Math.round(avgMastery)}% dominio promedio\n`
            analysisText += `- ${Math.round(recentAccuracy)}% precisión reciente\n\n`

            if (avgMastery < 40) {
              analysisText += `**Recomendación:** Enfócate en dominar conceptos básicos antes de avanzar.\n\n`
            } else if (avgMastery > 70) {
              analysisText += `**Recomendación:** Excelente progreso. Considera temas más avanzados.\n\n`
            } else {
              analysisText += `**Recomendación:** Buen progreso. Continúa con práctica regular.\n\n`
            }

            analysisText += `**Próximos pasos:**\n`
            if (topicsCount === 0) {
              analysisText += `1. Comienza con temas fundamentales\n`
              analysisText += `2. Establece una rutina de estudio\n`
            } else {
              const weakestTopic = Object.entries(mastery).sort((a, b) => a[1].level - b[1].level)[0]
              analysisText += `1. Refuerza ${weakestTopic[0]} (${weakestTopic[1].level}% dominio)\n`
              analysisText += `2. Mantén práctica regular\n`
            }

            res.setHeader("Content-Type", "application/json")
            res.writeHead(200)
            res.end(
              JSON.stringify({
                response: analysisText + `\n💡 Configura GROQ_API_KEY para análisis detallados`,
                chunks_used: topicsCount + recentSessions.length,
                source: "📊 Análisis básico",
                processingTime: totalTime,
                studentDashboard: dashboard,
                masteryData: mastery,
              }),
            )
          }
        } else {
          logProgress("PROGRESS_ANALYSIS", 5, 7, "No AI available, generating basic analysis")
          const totalTime = Date.now() - startTime
          logProgress("PROGRESS_ANALYSIS", 7, 7, `Basic analysis completed in ${totalTime}ms`)

          const topicsCount = Object.keys(mastery).length
          const avgMastery =
            topicsCount > 0 ? Object.values(mastery).reduce((sum, topic) => sum + topic.level, 0) / topicsCount : 0

          res.setHeader("Content-Type", "application/json")
          res.writeHead(200)
          res.end(
            JSON.stringify({
              response: `🤖 **Análisis de Progreso** (${totalTime}ms)\n\n**Estado:** ${topicsCount} temas, ${Math.round(avgMastery)}% promedio\n\n**Evaluación:** ${avgMastery > 60 ? "Buen progreso" : "Necesita más práctica"}\n\n**Próximos pasos:**\n1. ${avgMastery < 40 ? "Refuerza conceptos básicos" : "Continúa avanzando"}\n2. Mantén práctica regular\n3. Usa quizzes para autoevaluación\n\n💡 Configura GROQ_API_KEY para análisis avanzados`,
              chunks_used: topicsCount,
              source: "📊 Agente básico",
              processingTime: totalTime,
              studentDashboard: dashboard,
              masteryData: mastery,
            }),
          )
        }
      } catch (error) {
        console.error("❌ Progress analysis error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Progress analysis failed", details: error.message }))
      }
    } else if (pathname === "/api/student/dashboard" && req.method === "GET") {
      // Student Dashboard endpoint
      try {
        const { studentId = "anonymous" } = query

        console.log(`📊 Dashboard request for student: ${studentId}`)
        const dashboard = studentManager.getStudentDashboard(studentId)
        const mastery = studentManager.getStudentMastery(studentId)

        res.setHeader("Content-Type", "application/json")
        res.writeHead(200)
        res.end(
          JSON.stringify({
            dashboard,
            mastery,
            timestamp: new Date().toISOString(),
          }),
        )
      } catch (error) {
        console.error("❌ Dashboard error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Dashboard failed", details: error.message }))
      }
    } else if (pathname === "/api/student/interaction" && req.method === "POST") {
      // Record Student Interaction endpoint
      try {
        const body = await parseJSON(req)
        const { studentId = "anonymous", question, answer, isCorrect, type = "quiz", metadata = {} } = body

        if (!question || typeof isCorrect !== "boolean") {
          res.setHeader("Content-Type", "application/json")
          res.writeHead(400)
          res.end(
            JSON.stringify({
              error: "Missing required fields",
              required: ["question", "isCorrect"],
              example: {
                studentId: "student123",
                question: "¿Cuál es la derivada de x²?",
                answer: "2x",
                isCorrect: true,
                type: "quiz",
                metadata: { difficulty: "intermediate" },
              },
            }),
          )
          return
        }

        console.log(`📝 Recording interaction for ${studentId}: ${type} - ${isCorrect ? "✅" : "❌"}`)

        // Process the interaction through BKT
        const result = studentManager.processStudentInteraction(studentId, {
          question,
          answer,
          isCorrect,
          type,
          metadata,
        })

        res.setHeader("Content-Type", "application/json")
        res.writeHead(200)
        res.end(
          JSON.stringify({
            success: true,
            result,
            message: "Interaction recorded and BKT model updated",
            timestamp: new Date().toISOString(),
          }),
        )
      } catch (error) {
        console.error("❌ Interaction recording error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Failed to record interaction", details: error.message }))
      }
    } else if (pathname === "/api/students" && req.method === "GET") {
      // All Students Summary endpoint
      try {
        console.log(`👥 All students summary request`)
        const summary = studentManager.getAllStudentsSummary()

        res.setHeader("Content-Type", "application/json")
        res.writeHead(200)
        res.end(JSON.stringify(summary))
      } catch (error) {
        console.error("❌ Students summary error:", error)
        res.setHeader("Content-Type", "application/json")
        res.writeHead(500)
        res.end(JSON.stringify({ error: "Failed to get students summary", details: error.message }))
      }
    } else if (pathname === "/search") {
      // Search endpoint with adaptive filtering
      const { q: queryParam, limit = 5, studentId = "anonymous", level } = query

      if (!queryParam) {
        res.setHeader("Content-Type", "application/json")
        res.writeHead(400)
        res.end(JSON.stringify({ error: "Query parameter 'q' is required" }))
        return
      }

      // Determine adaptive level
      let adaptiveLevel = level || "intermediate"
      if (studentId !== "anonymous") {
        const mastery = studentManager.getStudentMastery(studentId)
        if (Object.keys(mastery).length > 0) {
          const avgMastery =
            Object.values(mastery).reduce((sum, topic) => sum + topic.level, 0) / Object.keys(mastery).length
          if (avgMastery < 40) adaptiveLevel = "beginner"
          else if (avgMastery > 70) adaptiveLevel = "advanced"
        }
      }

      console.log(`🔍 Adaptive search query from ${studentId}: "${queryParam}" (level: ${adaptiveLevel})`)
      const results = searchChunks(queryParam, Number.parseInt(limit), adaptiveLevel)

      res.setHeader("Content-Type", "application/json")
      res.writeHead(200)
      res.end(JSON.stringify(results))
    } else {
      // 404
      res.setHeader("Content-Type", "application/json")
      res.writeHead(404)
      res.end(
        JSON.stringify({
          error: "Endpoint not found",
          available_endpoints: [
            "GET / - Main UI",
            "GET /api - API status with student stats",
            "POST /api/chat - Adaptive RAG chat",
            "POST /api/quiz - Adaptive quiz generation",
            "POST /api/plan - Personalized study plans",
            "POST /api/agents - Student progress analysis",
            "GET /api/student/dashboard?studentId=X - Student dashboard",
            "POST /api/student/interaction - Record student interaction",
            "GET /api/students - All students summary",
            "GET /search?q=query&studentId=X - Adaptive search",
          ],
        }),
      )
    }
  } catch (error) {
    console.error("Server error:", error)
    res.setHeader("Content-Type", "application/json")
    res.writeHead(500)
    res.end(JSON.stringify({ error: "Internal server error", details: error.message }))
  }
})

// Start server
function startServer() {
  console.log("🔧 Environment Variables Check:")
  console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "✅ Loaded" : "❌ Missing")
  console.log("PORT:", process.env.PORT || "3000 (default)")

  server.listen(PORT, () => {
    console.log(`🚀 Mora + DeerFlow Adaptive Server running on http://localhost:${PORT}`)
    console.log(`📚 Chunks loaded: ${chunks.length} (REAL CHUNKS ONLY)`)
    console.log(`🔑 GROQ API: ${process.env.GROQ_API_KEY ? "✅ Configured" : "❌ Missing"}`)
    console.log(`🧠 BKT Model: ✅ Active with adaptive learning`)
    console.log(`👤 Student Manager: ✅ Ready for personalization`)
    console.log(`📁 Test the adaptive chat at: http://localhost:${PORT}`)
    console.log(`🧪 Test API status: http://localhost:${PORT}/api`)

    console.log(`📊 Content Stats:`)
    console.log(`   └── Sources: ${indexMetadata.processing_stats?.total_sources || "Unknown"}`)
    console.log(`   └── Avg length: ${indexMetadata.processing_stats?.avg_chunk_length || "Unknown"} chars`)
    console.log(`   └── Total chunks: ${chunks.length}`)

    console.log(`🎯 Adaptive Features:`)
    console.log(`   └── BKT Student Modeling: ✅`)
    console.log(`   └── Personalized Content: ✅`)
    console.log(`   └── Progress Tracking: ✅`)
    console.log(`   └── Adaptive Difficulty: ✅`)
    console.log(`   └── Smart Recommendations: ✅`)
  })
}

startServer()
