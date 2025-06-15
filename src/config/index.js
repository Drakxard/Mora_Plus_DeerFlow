import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar variables de entorno desde .env
dotenv.config()

/**
 * Configuración centralizada para Mora + DeerFlow
 * Combina variables de entorno (.env) con configuración YAML opcional (conf.yaml)
 * Prioridad: .env > conf.yaml > defaults
 */
class ConfigManager {
  constructor() {
    this.envConfig = this.loadEnvConfig()
    this.yamlConfig = this.loadYamlConfig()
    this.config = this.mergeConfigs()
    this.validateConfig()
  }

  /**
   * Cargar configuración desde variables de entorno
   */
  loadEnvConfig() {
    return {
      // Application Settings
      env: process.env.NODE_ENV || process.env.APP_ENV || "development",
      debug: process.env.DEBUG === "true" || process.env.DEBUG === "True",
      port: Number.parseInt(process.env.PORT) || 3000,

      // Logging Configuration
      logLevel: process.env.LOG_LEVEL || "info",
      enableConsoleLogs: process.env.ENABLE_CONSOLE_LOGS !== "false",
      logFilePath: process.env.LOG_FILE_PATH || "logs/app.log",
      logMaxSize: process.env.LOG_MAX_SIZE || "10m",
      logMaxFiles: Number.parseInt(process.env.LOG_MAX_FILES) || 5,

      // Groq API Configuration
      groqApiKey: process.env.GROQ_API_KEY,
      groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      groqModel: process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      useToolCalling: process.env.USE_TOOL_CALLING === "true",
      groqMaxTokens: Number.parseInt(process.env.GROQ_MAX_TOKENS) || 2048,
      groqTemperature: Number.parseFloat(process.env.GROQ_TEMPERATURE) || 0.7,
      groqTimeout: Number.parseInt(process.env.GROQ_TIMEOUT) || 30000,

      // DeerFlow Agent Configuration
      agentRecursionLimit: Number.parseInt(process.env.AGENT_RECURSION_LIMIT) || 30,
      nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",

      // Search Engine Configuration
      searchApi: process.env.SEARCH_API || "tavily",
      tavilyApiKey: process.env.TAVILY_API_KEY,
      braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
      jinaApiKey: process.env.JINA_API_KEY,

      // RAG Provider Configuration
      ragProvider: process.env.RAG_PROVIDER,
      ragflowApiUrl: process.env.RAGFLOW_API_URL,
      ragflowApiKey: process.env.RAGFLOW_API_KEY,
      ragflowRetrievalSize: Number.parseInt(process.env.RAGFLOW_RETRIEVAL_SIZE) || 10,

      // TTS Configuration
      ttsAppId: process.env.VOLCENGINE_TTS_APPID,
      ttsAccessToken: process.env.VOLCENGINE_TTS_ACCESS_TOKEN,
      ttsCluster: process.env.VOLCENGINE_TTS_CLUSTER || "volcano_tts",
      ttsVoiceType: process.env.VOLCENGINE_TTS_VOICE_TYPE || "BV700_V2_streaming",

      // Monitoring and Tracing
      langsmithTracing: process.env.LANGSMITH_TRACING === "true",
      langsmithEndpoint: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
      langsmithApiKey: process.env.LANGSMITH_API_KEY,
      langsmithProject: process.env.LANGSMITH_PROJECT,

      // Cache Configuration
      cacheTtlEmbeddings: Number.parseInt(process.env.CACHE_TTL_EMBEDDINGS) || 3600000,
      cacheTtlSearch: Number.parseInt(process.env.CACHE_TTL_SEARCH) || 900000,
      cacheTtlChat: Number.parseInt(process.env.CACHE_TTL_CHAT) || 600000,
      cacheTtlBkt: Number.parseInt(process.env.CACHE_TTL_BKT) || 300000,
      cacheMaxSize: Number.parseInt(process.env.CACHE_MAX_SIZE) || 1000,

      // Performance Configuration
      batchSizeChat: Number.parseInt(process.env.BATCH_SIZE_CHAT) || 3,
      batchSizeQuiz: Number.parseInt(process.env.BATCH_SIZE_QUIZ) || 5,
      batchSizeAgent: Number.parseInt(process.env.BATCH_SIZE_AGENT) || 4,
      batchTimeout: Number.parseInt(process.env.BATCH_TIMEOUT) || 2000,
      concurrencyLimit: Number.parseInt(process.env.CONCURRENCY_LIMIT) || 3,
      rateLimitRpm: Number.parseInt(process.env.RATE_LIMIT_RPM) || 30,
      rateLimitRph: Number.parseInt(process.env.RATE_LIMIT_RPH) || 1000,

      // Database Configuration
      dbPath: process.env.DB_PATH || "data/students.json",
      backupInterval: Number.parseInt(process.env.BACKUP_INTERVAL) || 3600000,
      maxBackups: Number.parseInt(process.env.MAX_BACKUPS) || 10,

      // Embedding Configuration
      maxContextChunks: Number.parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5,
      embeddingModel: process.env.EMBEDDING_MODEL || "all-MiniLM-L6-v2",
      chunkSize: Number.parseInt(process.env.CHUNK_SIZE) || 500,
      chunkOverlap: Number.parseInt(process.env.CHUNK_OVERLAP) || 50,
    }
  }

  /**
   * Cargar configuración desde conf.yaml (opcional)
   */
  loadYamlConfig() {
    try {
      const projectRoot = path.resolve(__dirname, "../..")
      const yamlPath = path.join(projectRoot, "conf.yaml")

      if (!fs.existsSync(yamlPath)) {
        console.log("📄 No conf.yaml found, using environment variables only")
        return {}
      }

      const yamlContent = fs.readFileSync(yamlPath, "utf8")
      const yamlConfig = yaml.load(yamlContent)

      console.log("📄 Loaded configuration from conf.yaml")
      return this.flattenYamlConfig(yamlConfig)
    } catch (error) {
      console.warn("⚠️  Error loading conf.yaml:", error.message)
      return {}
    }
  }

  /**
   * Aplanar configuración YAML anidada
   */
  flattenYamlConfig(yamlConfig) {
    const flattened = {}

    // Mapear configuración YAML a estructura plana
    if (yamlConfig.USE_TOOL_CALLING !== undefined) {
      flattened.useToolCalling = yamlConfig.USE_TOOL_CALLING
    }

    if (yamlConfig.BASIC_MODEL) {
      const basicModel = yamlConfig.BASIC_MODEL
      if (basicModel.base_url) flattened.groqBaseUrl = basicModel.base_url
      if (basicModel.model) flattened.groqModel = basicModel.model
      if (basicModel.api_key) {
        // Resolver variables de entorno en YAML
        flattened.groqApiKey = basicModel.api_key.startsWith("$")
          ? process.env[basicModel.api_key.slice(1)]
          : basicModel.api_key
      }
    }

    // Añadir más mapeos según sea necesario
    if (yamlConfig.SEARCH_API) flattened.searchApi = yamlConfig.SEARCH_API
    if (yamlConfig.TAVILY_API_KEY) flattened.tavilyApiKey = yamlConfig.TAVILY_API_KEY
    if (yamlConfig.RAG_PROVIDER) flattened.ragProvider = yamlConfig.RAG_PROVIDER
    if (yamlConfig.RAGFLOW_API_URL) flattened.ragflowApiUrl = yamlConfig.RAGFLOW_API_URL
    if (yamlConfig.RAGFLOW_API_KEY) flattened.ragflowApiKey = yamlConfig.RAGFLOW_API_KEY

    return flattened
  }

  /**
   * Combinar configuraciones con prioridad: .env > conf.yaml > defaults
   */
  mergeConfigs() {
    const merged = { ...this.yamlConfig, ...this.envConfig }

    // Filtrar valores undefined/null
    Object.keys(merged).forEach((key) => {
      if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
        delete merged[key]
      }
    })

    return merged
  }

  /**
   * Validar configuración crítica
   */
  validateConfig() {
    const errors = []
    const warnings = []

    // Validaciones críticas
    if (!this.config.groqApiKey) {
      errors.push("GROQ_API_KEY is required")
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push("PORT must be between 1 and 65535")
    }

    // Validaciones de advertencia
    if (this.config.searchApi === "tavily" && !this.config.tavilyApiKey) {
      warnings.push("TAVILY_API_KEY not set, search functionality may be limited")
    }

    if (this.config.searchApi === "brave_search" && !this.config.braveSearchApiKey) {
      warnings.push("BRAVE_SEARCH_API_KEY not set for brave_search")
    }

    if (this.config.ragProvider === "ragflow" && (!this.config.ragflowApiUrl || !this.config.ragflowApiKey)) {
      warnings.push("RAGFlow configuration incomplete")
    }

    // Mostrar errores y advertencias
    if (errors.length > 0) {
      console.error("❌ Configuration errors:")
      errors.forEach((error) => console.error(`   - ${error}`))
      throw new Error("Configuration validation failed")
    }

    if (warnings.length > 0) {
      console.warn("⚠️  Configuration warnings:")
      warnings.forEach((warning) => console.warn(`   - ${warning}`))
    }

    console.log("✅ Configuration validated successfully")
  }

  /**
   * Obtener configuración completa
   */
  getConfig() {
    return this.config
  }

  /**
   * Obtener valor específico de configuración
   */
  get(key, defaultValue = undefined) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue
  }

  /**
   * Verificar si una característica está habilitada
   */
  isEnabled(feature) {
    return this.config[feature] === true || this.config[feature] === "true"
  }

  /**
   * Obtener configuración de Groq
   */
  getGroqConfig() {
    return {
      apiKey: this.config.groqApiKey,
      baseUrl: this.config.groqBaseUrl,
      model: this.config.groqModel,
      maxTokens: this.config.groqMaxTokens,
      temperature: this.config.groqTemperature,
      timeout: this.config.groqTimeout,
      useToolCalling: this.config.useToolCalling,
    }
  }

  /**
   * Obtener configuración de búsqueda
   */
  getSearchConfig() {
    return {
      api: this.config.searchApi,
      tavilyApiKey: this.config.tavilyApiKey,
      braveSearchApiKey: this.config.braveSearchApiKey,
      jinaApiKey: this.config.jinaApiKey,
    }
  }

  /**
   * Obtener configuración de RAG
   */
  getRagConfig() {
    return {
      provider: this.config.ragProvider,
      ragflowApiUrl: this.config.ragflowApiUrl,
      ragflowApiKey: this.config.ragflowApiKey,
      ragflowRetrievalSize: this.config.ragflowRetrievalSize,
    }
  }

  /**
   * Obtener configuración de cache
   */
  getCacheConfig() {
    return {
      ttlEmbeddings: this.config.cacheTtlEmbeddings,
      ttlSearch: this.config.cacheTtlSearch,
      ttlChat: this.config.cacheTtlChat,
      ttlBkt: this.config.cacheTtlBkt,
      maxSize: this.config.cacheMaxSize,
    }
  }

  /**
   * Obtener configuración de performance
   */
  getPerformanceConfig() {
    return {
      batchSizeChat: this.config.batchSizeChat,
      batchSizeQuiz: this.config.batchSizeQuiz,
      batchSizeAgent: this.config.batchSizeAgent,
      batchTimeout: this.config.batchTimeout,
      concurrencyLimit: this.config.concurrencyLimit,
      rateLimitRpm: this.config.rateLimitRpm,
      rateLimitRph: this.config.rateLimitRph,
    }
  }

  /**
   * Obtener configuración de logging
   */
  getLoggingConfig() {
    return {
      level: this.config.logLevel,
      enableConsole: this.config.enableConsoleLogs,
      filePath: this.config.logFilePath,
      maxSize: this.config.logMaxSize,
      maxFiles: this.config.logMaxFiles,
    }
  }

  /**
   * Mostrar resumen de configuración (sin claves sensibles)
   */
  showSummary() {
    const summary = {
      environment: this.config.env,
      port: this.config.port,
      debug: this.config.debug,
      groqModel: this.config.groqModel,
      searchApi: this.config.searchApi,
      ragProvider: this.config.ragProvider || "none",
      useToolCalling: this.config.useToolCalling,
      logLevel: this.config.logLevel,
      cacheEnabled: this.config.cacheMaxSize > 0,
    }

    console.log("📋 Configuration Summary:")
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`)
    })
  }
}

// Crear instancia singleton
const configManager = new ConfigManager()
const config = configManager.getConfig()

// Exportar configuración y manager
export default config
export { configManager }
export const {
  env,
  debug,
  port,
  logLevel,
  enableConsoleLogs,
  groqApiKey,
  groqBaseUrl,
  groqModel,
  useToolCalling,
  searchApi,
  tavilyApiKey,
  ragProvider,
  ragflowApiUrl,
  ragflowApiKey,
} = config
