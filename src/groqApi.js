import { modelSelector } from "./config/model_selector.js"

export async function callGroqAPI(prompt, taskType = "chat") {
  const startTime = Date.now()

  try {
    console.log("🤖 GROQ API Call Starting...")
    console.log(`📝 Prompt length: ${prompt.length} characters`)
    console.log(`🎯 Task type: ${taskType}`)

    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not found in environment variables")
    }

    console.log("🔑 API Key validated")

    // Get optimal model for this task type
    let selectedModel
    try {
      const selections = await modelSelector.selectOptimalModels()
      selectedModel = selections[taskType] || selections.chat || "llama-3.1-8b-instant"
      console.log(`🤖 Selected model for ${taskType}: ${selectedModel}`)
    } catch (error) {
      console.warn("⚠️ Model selection failed, using default")
      selectedModel = "llama-3.1-8b-instant"
    }

    // Enhanced system prompt with LaTeX formatting instructions
    const systemPrompt = `Eres un asistente especializado en matemáticas y educación adaptativa. 

IMPORTANTE - FORMATO MATEMÁTICO:
Cada vez que generes expresiones matemáticas, envuélvelas siempre entre delimitadores $ de la siguiente forma:
$\\<tu_LaTeX_aquí>$

No generes imágenes ni SVGs de las fórmulas; asume que el cliente usará KaTeX con auto-render en el front-end. 

Cuando te pregunten por derivadas, integrales, sumatorias u otras operaciones, responde usando puro LaTeX y colócalo siempre entre $...$. 

Ejemplos:
- "¿Cuál es la derivada de sen x?" → $\\frac{d}{dx}\\bigl(\\sin x\\bigr) = \\cos x$
- "Integral de x²" → $\\int x^2 dx = \\frac{x^3}{3} + C$
- "Función cuadrática" → $f(x) = ax^2 + bx + c$
- "Límite" → $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$

No uses otros delimitadores ni escapes adicionales; confía en que el front-end procesará $...$ con KaTeX.

CONTEXTO EDUCATIVO:
Adapta tu respuesta al nivel del estudiante y proporciona explicaciones claras y pedagógicas.
Si tienes contexto de materiales de estudio, úsalo para dar respuestas más precisas y relevantes.`

    const requestBody = {
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: selectedModel,
      max_tokens: 1000,
      temperature: 0.7,
    }

    console.log(`📊 Request config: ${selectedModel}, max_tokens: 1000`)
    console.log("🌐 Sending request to GROQ...")

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseTime = Date.now() - startTime
    console.log(`⏱️ Response received in ${responseTime}ms`)

    if (!response.ok) {
      const errorData = await response.json()
      console.log(`❌ GROQ API Error ${response.status}: ${JSON.stringify(errorData)}`)

      // Try fallback model if primary fails
      if (selectedModel !== "llama-3.1-8b-instant") {
        console.log("🔄 Trying fallback model...")
        return callGroqAPI(prompt, "chat") // Use chat as fallback
      }

      throw new Error(`GROQ API error (${response.status}): ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("No content in GROQ API response")
    }

    console.log(`✅ GROQ API Success in ${responseTime}ms`)
    console.log(`📄 Response length: ${content.length} characters`)

    return content.trim()
  } catch (error) {
    const errorTime = Date.now() - startTime
    console.error(`❌ GROQ API Error after ${errorTime}ms: ${error.message}`)
    throw error
  }
}

// Enhanced function for quiz generation with LaTeX support
export async function callGroqAPIForQuiz(prompt, taskType = "quiz") {
  const enhancedPrompt = `${prompt}

IMPORTANTE - FORMATO MATEMÁTICO PARA QUIZ:
Todas las expresiones matemáticas deben estar envueltas en delimitadores $ así: $\\<LaTeX>$
Ejemplos: $x^2$, $\\frac{d}{dx}$, $\\sin(x)$, $\\int_0^1 x dx$

Formato del quiz:
**Pregunta 1:**
[Pregunta con fórmulas en $LaTeX$]

**Opciones:**
a) [Opción con $LaTeX$ si es necesario]
b) [Opción con $LaTeX$ si es necesario]
c) [Opción con $LaTeX$ si es necesario]
d) [Opción con $LaTeX$ si es necesario]

**Respuesta correcta:** [letra]
**Explicación:** [Explicación detallada con $LaTeX$]`

  return callGroqAPI(enhancedPrompt, taskType)
}

// Enhanced function for study plan generation with LaTeX support
export async function callGroqAPIForPlan(prompt, taskType = "plan") {
  const enhancedPrompt = `${prompt}

IMPORTANTE - FORMATO MATEMÁTICO PARA PLAN:
Todas las fórmulas y expresiones matemáticas deben estar en formato $LaTeX$ así: $\\<expresión>$
Ejemplos: $f(x) = x^2$, $\\lim_{x \\to 0}$, $\\sum_{i=1}^n$

Estructura del plan:
**Día X: [Tema]**
- Objetivos: [Con $LaTeX$ si es necesario]
- Actividades: [Con $LaTeX$ si es necesario]
- Tiempo estimado: X minutos
- Recursos: [Enlaces o materiales]

Incluye ejercicios prácticos con notación matemática apropiada.`

  return callGroqAPI(enhancedPrompt, taskType)
}

// Enhanced function for agent analysis with LaTeX support
export async function callGroqAPIForAgents(prompt, taskType = "agents") {
  const enhancedPrompt = `${prompt}

IMPORTANTE - FORMATO MATEMÁTICO PARA ANÁLISIS:
Si mencionas conceptos matemáticos, usa siempre delimitadores $ así: $\\<LaTeX>$
Ejemplos: $\\frac{d}{dx}$, $\\sin x$, $x^2 + 2x + 1$, $\\lim_{x \\to \\infty}$

Proporciona un análisis detallado y constructivo con recomendaciones específicas.
Usa notación matemática apropiada cuando sea relevante.`

  return callGroqAPI(enhancedPrompt, taskType)
}
