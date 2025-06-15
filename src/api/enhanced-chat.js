const fs = require("fs")
const path = require("path")

class EnhancedChatAPI {
  constructor() {
    this.chunksFile = path.join(__dirname, "../../data/enhanced_chunks.json")
    this.refinementContext = new Map()
    this.unidades = [
      "U1-Res. de Problemas",
      "U2-Alg. Computacionales",
      "U3-Est. de Control",
      "U4-Arreglos",
      "U5-Intro Prog.",
      "U6-Intro C++",
      "U7-Est. de Control",
      "U8-Funciones",
      "U9-Arreglos y Structs",
    ]
  }

  loadChunks() {
    try {
      if (fs.existsSync(this.chunksFile)) {
        const data = fs.readFileSync(this.chunksFile, "utf8")
        return JSON.parse(data)
      }
      return []
    } catch (error) {
      console.error("Error loading chunks:", error)
      return []
    }
  }

  filterByVectorTemas(chunks, vectorTemas, threshold = 0.3) {
    if (!vectorTemas || vectorTemas.length === 0) {
      return chunks
    }

    // Simple keyword-based filtering for now
    // In production, you'd use semantic similarity
    const temasLower = vectorTemas.map((t) => t.toLowerCase())

    return chunks.filter((chunk) => {
      const textLower = chunk.text.toLowerCase()
      return temasLower.some((tema) => textLower.includes(tema))
    })
  }

  filterByEje(chunks, ejeActivo) {
    if (!ejeActivo) {
      return chunks
    }
    return chunks.filter((c) => c.metadata && c.metadata.eje === ejeActivo)
  }

  filterByMode(chunks, mode) {
    return chunks.filter((c) => c.metadata && c.metadata.type === mode)
  }

  getFilteredChunks(vectorTemas = [], ejeActivo = null, mode = "theory", maxChunks = 10) {
    let chunks = this.loadChunks()

    console.log(`Starting with ${chunks.length} chunks`)

    // 1. Filter by eje if specified
    if (ejeActivo) {
      chunks = this.filterByEje(chunks, ejeActivo)
      console.log(`After eje filter (${ejeActivo}): ${chunks.length} chunks`)
    }

    // 2. Filter by vector temas
    if (vectorTemas && vectorTemas.length > 0) {
      chunks = this.filterByVectorTemas(chunks, vectorTemas)
      console.log(`After vector temas filter: ${chunks.length} chunks`)
    }

    // 3. Filter by mode
    chunks = this.filterByMode(chunks, mode)
    console.log(`After mode filter (${mode}): ${chunks.length} chunks`)

    // 4. Limit number of chunks
    return chunks.slice(0, maxChunks)
  }

  generateSuggestions(vectorTemas, mode = "practice", ejeActivo = null) {
    const filteredChunks = this.getFilteredChunks(vectorTemas, ejeActivo, mode, 20)

    if (filteredChunks.length === 0) {
      return ["No se encontraron chunks relevantes para los temas especificados"]
    }

    // Extract suggestions from chunks
    const suggestions = []
    for (let i = 0; i < Math.min(5, filteredChunks.length); i++) {
      const chunk = filteredChunks[i]
      const text = chunk.text
      const sentences = text.split(".")

      if (sentences.length > 0) {
        let suggestion = sentences[0].trim()
        if (suggestion.length > 100) {
          suggestion = suggestion.substring(0, 100) + "..."
        }

        const eje = chunk.metadata ? chunk.metadata.eje : "General"
        suggestions.push(`${eje}: ${suggestion}`)
      }
    }

    return suggestions.length > 0 ? suggestions : ["No se pudieron generar sugerencias específicas"]
  }

  isRefinementResponse(query) {
    const lowerQuery = query.toLowerCase().trim()
    return (
      lowerQuery === "ok" || lowerQuery === "no" || lowerQuery.includes("está bien") || lowerQuery.includes("refinar")
    )
  }

  isPracticeTopicRequest(query) {
    const lowerQuery = query.toLowerCase()
    return (
      lowerQuery.includes("temas a integrar") ||
      (lowerQuery.includes("práctica") && lowerQuery.includes("temas")) ||
      lowerQuery.includes("ejercicios sugeridos")
    )
  }

  async handleRefinementResponse(query, studentId, originalRequest) {
    const lowerQuery = query.toLowerCase().trim()
    const context = this.refinementContext.get(studentId)

    if (!context) {
      return {
        response: "No hay contexto de refinamiento activo. Solicita temas de práctica primero.",
        error: "No refinement context",
      }
    }

    if (lowerQuery === "ok" || lowerQuery.includes("está bien")) {
      // User approved suggestions
      this.savePersistentPlan(studentId, context.suggestions, originalRequest)
      this.refinementContext.delete(studentId)

      return {
        response: `✅ Plan guardado exitosamente. Temas confirmados:\n\n${context.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n¿Quieres continuar con ejercicios específicos?`,
        planSaved: true,
      }
    } else {
      // User wants refinement
      const refinedSuggestions = await this.refineTopicSuggestions(
        context.vectorTemas,
        context.ejeActivo,
        context.mode,
        query,
      )

      // Update context
      this.refinementContext.set(studentId, {
        ...context,
        suggestions: refinedSuggestions,
        refinementCount: (context.refinementCount || 0) + 1,
      })

      return {
        response: `🔄 Sugerencias refinadas:\n\n${refinedSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n¿Te parecen mejor ahora? (OK/NO)`,
        suggestions: refinedSuggestions,
        isRefinement: true,
      }
    }
  }

  async handlePracticeTopicRequest(vectorTemas, ejeActivo, studentId) {
    const suggestions = this.generateSuggestions(vectorTemas, "practice", ejeActivo)

    // Store refinement context
    this.refinementContext.set(studentId, {
      vectorTemas,
      ejeActivo,
      mode: "practice",
      suggestions,
      timestamp: Date.now(),
    })

    return {
      response: `🎯 Sugerencias de práctica${ejeActivo ? ` para ${ejeActivo}` : ""}:\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n¿Te parecen bien estos temas? Responde "OK" para continuar o "NO" para refinar.`,
      suggestions,
      awaitingRefinement: true,
    }
  }

  async refineTopicSuggestions(vectorTemas, ejeActivo, mode, userFeedback) {
    // Simple refinement - in production you'd use LLM
    const baseTopics = this.generateSuggestions(vectorTemas, mode, ejeActivo)
    return baseTopics.map((topic) => `Refinado: ${topic}`)
  }

  savePersistentPlan(studentId, suggestions, context) {
    const plan = {
      studentId,
      suggestions,
      vectorTemas: context.vectorTemas,
      ejeActivo: context.ejeActivo,
      mode: context.mode,
      timestamp: Date.now(),
      status: "active",
    }

    // Save to file or database
    const plansFile = path.join(__dirname, "../../data/persistent_plans.json")
    let plans = []

    try {
      if (fs.existsSync(plansFile)) {
        plans = JSON.parse(fs.readFileSync(plansFile, "utf8"))
      }
    } catch (error) {
      console.error("Error loading plans:", error)
    }

    plans.push(plan)

    try {
      fs.writeFileSync(plansFile, JSON.stringify(plans, null, 2))
      console.log("Plan saved successfully")
    } catch (error) {
      console.error("Error saving plan:", error)
    }
  }

  async processEnhancedChat(request) {
    const { query, vectorTemas = [], ejeActivo = null, mode = "theory", studentId = "default" } = request

    try {
      // Handle refinement responses
      if (this.isRefinementResponse(query)) {
        return await this.handleRefinementResponse(query, studentId, request)
      }

      // Handle practice topic requests
      if (this.isPracticeTopicRequest(query)) {
        return await this.handlePracticeTopicRequest(vectorTemas, ejeActivo, studentId)
      }

      // Regular chat with enhanced filtering
      const filteredChunks = this.getFilteredChunks(vectorTemas, ejeActivo, mode, 10)

      const response = await this.generateResponse(query, filteredChunks, {
        vectorTemas,
        ejeActivo,
        mode,
      })

      return {
        response,
        chunks_used: filteredChunks.length,
        source: `Enhanced (${mode})`,
        vectorTemas,
        ejeActivo,
        mode,
      }
    } catch (error) {
      console.error("Enhanced chat error:", error)
      return {
        error: error.message,
        response: "Error procesando la consulta con filtros avanzados.",
      }
    }
  }

  async generateResponse(query, chunks, context) {
    const chunksText = chunks.map((c) => c.text).join("\n\n")

    // Simple response generation - in production you'd use your LLM
    const response = `Respuesta para: "${query}"

Modo: ${context.mode === "theory" ? "Teoría" : "Práctica"}
${context.ejeActivo ? `Eje: ${context.ejeActivo}` : ""}
${context.vectorTemas.length > 0 ? `Temas: ${context.vectorTemas.join(", ")}` : ""}

Usando ${chunks.length} chunks relevantes del contenido.

${chunksText ? `Contenido relacionado:\n${chunksText.substring(0, 500)}...` : "No se encontró contenido específico."}`

    return response
  }
}

module.exports = { EnhancedChatAPI }
