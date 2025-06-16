# Mora + DeerFlow – Sistema Completo de Aprendizaje Adaptativo con Agentes IA (README DESACTUALIZADO)

Sistema de búsqueda semántica con chat RAG, modelado de estudiante usando BKT (Bayesian Knowledge Tracing), quizzes adaptativos, planificación personalizada y **agentes DeerFlow especializados** para flujos académicos avanzados.

## 🏗️ Arquitectura

- **Python**: Procesamiento de texto, chunking semántico y generación de embeddings
- **Node.js + Express**: API REST para búsqueda semántica, chat RAG, quizzes y agentes
- **BKT (Bayesian Knowledge Tracing)**: Modelado de estudiante y seguimiento de progreso
- **Quizzes Adaptativos**: Generación automática de preguntas personalizadas
- **Planificación Inteligente**: Planes de estudio adaptativos con recordatorios
- **Agentes DeerFlow**: Asistentes IA especializados para tareas académicas
- **Human-in-the-Loop**: Revisión y aprobación humana de contenido generado por IA
- **LowDB**: Base de datos ligera para persistencia de datos
- **Modelo**: `all-MiniLM-L6-v2` de Sentence Transformers + Groq/Llama

## 📁 Estructura del Proyecto

\`\`\`
mora-deerflow-semantic-search/
├── content/                    # Archivos .txt para indexar (vacío inicialmente)
├── embeddings/                 # Índice de embeddings generado
│   └── index.json             # Archivo de índice (se genera automáticamente)
├── scripts/                   # Scripts de Python y Node.js
│   ├── chunk_and_embed.py     # Procesamiento y indexación
│   ├── embed_single.py        # Embedding de consultas individuales
│   ├── reset-student-data.js  # Resetear datos de estudiantes
│   ├── reset-quiz-data.js     # Resetear datos de quizzes
│   ├── reset-plan-data.js     # Resetear datos de planes
│   └── reset-all-data.js      # Resetear todos los datos
├── src/                       # Código Node.js
│   ├── api/
│   │   ├── search.js          # Endpoint de búsqueda
│   │   ├── chat.js            # Endpoint de chat RAG
│   │   ├── progress.js          # Endpoint de progreso BKT
│   │   ├── quiz.js            # Endpoint de quizzes adaptativos
│   │   ├── plan.js            # Endpoint de planificación
│   │   ├── agents.js          # Endpoint de agentes DeerFlow
│   │   └── review.js          # Endpoint de revisión humana
│   ├── model/
│   │   ├── topics.js          # Definición de temas y clasificación
│   │   ├── bkt.js             # Implementación BKT
│   │   └── database.js        # Gestión de base de datos
│   ├── planner/
│   │   └── planModel.js       # Modelo de planificación de estudio
│   ├── scheduler/
│   │   └── reminders.js       # Sistema de recordatorios
│   ├── agents/                # **NUEVO** Agentes DeerFlow
│   │   ├── agentConfig.js     # Configuración y definición de agentes
│   │   ├── coordinator.js     # Coordinador de workflows
│   │   └── planner.js         # Planificador inteligente
│   ├── quiz/
│   │   └── quizGenerator.js   # Generador de quizzes adaptativos
│   ├── feedback/
│   │   └── feedbackGenerator.js # Generador de feedback adaptativo
│   ├── ui/
│   │   └── index.html         # Interfaz web completa con panel de agentes
│   └── server.js              # Servidor Express
├── data/                      # Base de datos
│   └── students.json          # Datos de progreso, quizzes, planes y revisiones
├── package.json
├── requirements.txt
└── README.md
\`\`\`

## 🤖 Agentes DeerFlow

### Agentes Disponibles

#### 1. **AcademicAgent** 🔬
- **Capacidades**: Búsqueda académica, análisis de contenido, recomendaciones de papers
- **Acciones**:
  - `search_academic`: Búsqueda en fuentes académicas (simulado ArXiv)
  - `analyze_content`: Análisis de complejidad y temas de contenido
  - `recommend_papers`: Recomendaciones personalizadas basadas en progreso

#### 2. **QuizAgent** 🎯
- **Capacidades**: Generación adaptativa, análisis de rendimiento, optimización de dificultad
- **Acciones**:
  - `generate_adaptive`: Generación de quizzes adaptativos
  - `analyze_performance`: Análisis de patrones de rendimiento
  - `optimize_difficulty`: Optimización de dificultad para futuros quizzes
  - `generate_feedback`: Feedback inteligente personalizado

#### 3. **ReportAgent** 📊
- **Capacidades**: Análisis de progreso, identificación de tendencias, generación de reportes
- **Acciones**:
  - `generate_report`: Reportes comprensivos de progreso
  - `analyze_trends`: Análisis de tendencias de aprendizaje
  - `create_insights`: Insights personalizados de aprendizaje

#### 4. **PlannerAgent** 📋
- **Capacidades**: Optimización de planes, ajuste de horarios, establecimiento de objetivos
- **Acciones**:
  - `optimize_plan`: Optimización de planes de estudio
  - `suggest_adjustments`: Sugerencias de ajustes
  - `next_step`: Sugerencia del siguiente paso óptimo
  - `review_goals`: Revisión y ajuste de objetivos

### Workflows Disponibles

#### 1. **daily_planning** 📅
Analiza progreso y genera plan diario óptimo
- Recopila datos de plan actual y progreso BKT
- Obtiene sugerencias del PlannerAgent
- Analiza temas del día y atrasados
- Genera plan diario comprensivo con prioridades

#### 2. **quiz_analysis** 🎯
Análisis comprensivo de rendimiento en quizzes
- Analiza rendimiento con QuizAgent
- Genera feedback inteligente
- Optimiza dificultad para próximos quizzes
- Sugiere ajustes al plan de estudio

#### 3. **progress_review** 📊
Revisión completa de progreso y tendencias
- Genera reporte detallado de progreso
- Analiza tendencias de aprendizaje
- Crea insights personalizados
- Revisa y ajusta objetivos

#### 4. **academic_research** 🔬
Búsqueda y análisis de contenido académico
- Búsqueda en fuentes académicas
- Análisis de contenido encontrado
- Generación de recomendaciones personalizadas

## 🚀 Instalación y Configuración

### 1. Instalar dependencias

\`\`\`bash
# Instalar dependencias de Python
pip3 install -r requirements.txt

# Instalar dependencias de Node.js
npm install
\`\`\`

### 2. Configuración

Mora + DeerFlow utiliza un sistema de configuración centralizada que combina variables de entorno (`.env`) con configuración YAML opcional (`conf.yaml`).

**Prioridad de configuración**: `.env` > `conf.yaml` > valores por defecto

#### Opción A: Configuración con .env (Recomendado)

\`\`\`bash
# Crear archivo de configuración desde la plantilla
npm run config:example

# Editar .env con tus claves API
nano .env
\`\`\`

**Variables críticas que debes configurar:**
\`\`\`env
GROQ_API_KEY=gsk_tu_clave_groq_aqui
TAVILY_API_KEY=tvly-tu_clave_tavily_aqui  # Opcional pero recomendado
\`\`\`

#### Opción B: Configuración con YAML (Avanzado)

\`\`\`bash
# Copiar plantilla YAML
cp conf.yaml.example conf.yaml

# Editar configuración YAML
nano conf.yaml
\`\`\`

### 3. Validar configuración

\`\`\`bash
# Validar que toda la configuración esté correcta
npm run validate-config
\`\`\`

### 4. Instalación completa automatizada

\`\`\`bash
# Setup completo con validación
npm run setup
\`\`\`

## 📋 Variables de Configuración

### 🔑 Variables Críticas

| Variable | Descripción | Requerida | Ejemplo |
|----------|-------------|-----------|---------|
| `GROQ_API_KEY` | Clave API de Groq para LLM | ✅ Sí | `gsk_xxx` |
| `PORT` | Puerto del servidor | ❌ No | `3000` |
| `NODE_ENV` | Entorno de ejecución | ❌ No | `development` |

### 🔍 Configuración de Búsqueda

| Variable | Descripción | Requerida | Ejemplo |
|----------|-------------|-----------|---------|
| `SEARCH_API` | Motor de búsqueda | ❌ No | `tavily` |
| `TAVILY_API_KEY` | Clave API de Tavily | ⚠️ Recomendado | `tvly-xxx` |
| `BRAVE_SEARCH_API_KEY` | Clave API de Brave Search | ❌ No | `BSA-xxx` |

### 🤖 Configuración de Groq/LLM

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `GROQ_MODEL` | Modelo de Groq a usar | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_MAX_TOKENS` | Máximo tokens por respuesta | `2048` |
| `GROQ_TEMPERATURE` | Creatividad del modelo (0-1) | `0.7` |
| `USE_TOOL_CALLING` | Habilitar tool calling | `true` |

### 📊 Configuración de Performance

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `BATCH_SIZE_CHAT` | Tamaño de lote para chat | `3` |
| `BATCH_SIZE_QUIZ` | Tamaño de lote para quizzes | `5` |
| `CONCURRENCY_LIMIT` | Límite de concurrencia | `3` |
| `RATE_LIMIT_RPM` | Límite por minuto | `30` |

### 💾 Configuración de Cache

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `CACHE_TTL_EMBEDDINGS` | TTL para embeddings (ms) | `3600000` (1h) |
| `CACHE_TTL_SEARCH` | TTL para búsquedas (ms) | `900000` (15m) |
| `CACHE_MAX_SIZE` | Tamaño máximo de cache | `1000` |

### 📝 Configuración de Logging

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `LOG_LEVEL` | Nivel de logging | `info` |
| `ENABLE_CONSOLE_LOGS` | Logs en consola | `true` |
| `LOG_FILE_PATH` | Ruta del archivo de log | `logs/app.log` |

## 🛠️ Scripts de Configuración

\`\`\`bash
# Validar configuración actual
npm run validate-config

# Crear .env desde plantilla
npm run config:example

# Verificar estado de configuración
npm run config:check

# Setup completo con validación
npm run setup
\`\`\`

## 📝 Uso

### 1. Añadir contenido

Coloca tus archivos de texto en la carpeta \`content/\`:

\`\`\`bash
# Ejemplos de archivos que puedes añadir:
content/
├── documento1.txt
├── transcripcion_reunion.txt
├── notas_proyecto.txt
└── manual_usuario.txt
\`\`\`

**Formatos soportados**: Archivos .txt (UTF-8)

### 2. Generar índice de embeddings

\`\`\`bash
# Procesar todos los archivos .txt y crear el índice
python3 scripts/chunk_and_embed.py

# O usando npm script
npm run index
\`\`\`

### 3. Iniciar el servidor

\`\`\`bash
npm start
\`\`\`

El servidor estará disponible en: \`http://localhost:3000\`

### 4. Usar la interfaz web

1. **Chat Inteligente**: Haz preguntas y recibe respuestas contextuales
2. **Quizzes Adaptativos**: Genera quizzes personalizados basados en tu progreso
3. **Plan de Aprendizaje**: Crea y gestiona planes de estudio personalizados
4. **Agentes IA**: Ejecuta tareas especializadas con agentes DeerFlow
5. **Panel de Progreso**: Visualiza tu avance por temas en tiempo real

## 🤖 API de Agentes

### Ejecutar Agente Individual

#### POST /agents/execute

**Cuerpo de la petición:**
\`\`\`json
{
  "agentName": "AcademicAgent",
  "userId": "demo-user",
  "action": "search_academic",
  "payload": {
    "query": "machine learning algorithms",
    "maxResults": 5
  }
}
\`\`\`

**Respuesta:**
\`\`\`json
{
  "success": true,
  "agent": "AcademicAgent",
  "action": "search_academic",
  "result": {
    "query": "machine learning algorithms",
    "papers": [
      {
        "title": "Advanced Machine Learning Techniques",
        "authors": ["Dr. Smith", "Dr. Johnson"],
        "abstract": "This paper explores...",
        "year": 2024,
        "relevance": 0.95,
        "arxiv_id": "2024.12345"
      }
    ],
    "totalResults": 3
  },
  "executionTime": 1250,
  "executedAt": "2024-01-15T10:30:00Z"
}
\`\`\`

### Ejecutar Workflow

#### POST /agents/workflow

**Cuerpo de la petición:**
\`\`\`json
{
  "workflowName": "daily_planning",
  "userId": "demo-user",
  "context": {
    "preferences": {
      "focusAreas": ["introduction", "intermediate"]
    }
  }
}
\`\`\`

**Respuesta:**
\`\`\`json
{
  "success": true,
  "workflowName": "daily_planning",
  "workflowId": "daily_planning_1705312200000",
  "result": {
    "userId": "demo-user",
    "date": "2024-01-15",
    "suggestion": {
      "action": "quiz",
      "topic": "introduction",
      "reason": "Optimal time for assessment",
      "estimatedTime": 15,
      "priority": "high"
    },
    "topics": {
      "scheduled": [],
      "overdue": [],
      "recommended": ["introduction"]
    },
    "estimatedTime": {
      "total": 45,
      "breakdown": {
        "study": 20,
        "review": 10,
        "assessment": 15
      }
    },
    "priority": "medium"
  },
  "executionTime": 2100
}
\`\`\`

### Generar Plan Inteligente

#### POST /agents/plan/generate

**Cuerpo de la petición:**
\`\`\`json
{
  "userId": "demo-user",
  "preferences": {
    "maxTopics": 8,
    "daysPerWeek": 5,
    "hoursPerDay": 1.5,
    "preferredDifficulty": 2,
    "focusAreas": ["introduction", "intermediate"],
    "includeWeekends": false,
    "startDate": "2024-01-15"
  }
}
\`\`\`

### Obtener Siguiente Acción

#### GET /agents/plan/next-action?userId=demo-user

**Respuesta:**
\`\`\`json
{
  "userId": "demo-user",
  "nextAction": {
    "action": "study",
    "topic": "introduction",
    "reason": "Continue with planned topic",
    "priority": "medium",
    "estimatedTime": 30,
    "details": {
      "suggestion": {
        "action": "study",
        "topic": "introduction",
        "reason": "Continue with planned topic",
        "estimatedTime": 30,
        "priority": "medium"
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

## 👁️ Human-in-the-Loop (Revisión Humana)

### Revisar Plan de Estudio

#### GET /review/plan?userId=demo-user

Obtiene un plan para revisión humana con:
- Plan actual y sugerencias de agentes
- Análisis de progreso
- Preguntas de revisión estructuradas
- Instrucciones para la revisión

#### POST /review/plan

Envía revisión y aprobación del plan:

\`\`\`json
{
  "userId": "demo-user",
  "planData": {
    "title": "Mi Plan Revisado",
    "topics": [
      {
        "topicId": "introduction",
        "targetDate": "2024-01-20",
        "estimatedMinutes": 45,
        "priority": "high",
        "approved": true
      }
    ],
    "humanFeedback": "El plan se ve bien, pero necesito más tiempo para temas avanzados",
    "approved": true
  }
}
\`\`\`

### Revisar Quiz

#### GET /review/quiz?userId=demo-user&quizId=quiz-123

#### POST /review/quiz

\`\`\`json
{
  "userId": "demo-user",
  "quizId": "quiz-123",
  "feedback": {
    "difficulty": "appropriate",
    "relevance": "high",
    "clarity": "good",
    "suggestions": "Consider adding more practical examples",
    "rating": 4
  },
  "approved": true
}
\`\`\`

### Obtener Revisiones Pendientes

#### GET /review/pending?userId=demo-user

\`\`\`json
{
  "userId": "demo-user",
  "pendingReviews": [
    {
      "type": "plan",
      "id": "plan-123",
      "title": "Study Plan Review",
      "description": "AI-generated study plan needs human approval",
      "priority": "medium",
      "estimatedTime": 10,
      "createdAt": "2024-01-15T08:00:00Z"
    }
  ],
  "totalPending": 1,
  "estimatedTotalTime": 10
}
\`\`\`

## 🛠️ Scripts Disponibles

\`\`\`bash
# Iniciar servidor completo
npm start

# Desarrollo con auto-reload
npm run dev

# Generar índice de embeddings
npm run index

# Probar embedding individual
npm run test-embed

# Instalación completa
npm run setup

# Resetear datos específicos
npm run reset-progress    # Solo progreso de estudiantes
npm run reset-quizzes     # Solo datos de quizzes
npm run reset-plans       # Solo planes de estudio
npm run reset-all         # Todos los datos

# Ejemplos de uso de agentes
# Ejecutar agente académico
curl -X POST http://localhost:3000/agents/execute \
  -H "Content-Type: application/json" \
  -d '{"agentName": "AcademicAgent", "userId": "demo-user", "action": "search_academic", "payload": {"query": "machine learning algorithms", "maxResults": 5}}'

# Ejecutar workflow diario
curl -X POST http://localhost:3000/agents/workflow \
  -H "Content-Type: application/json" \
  -d '{"workflowName": "daily_planning", "userId": "demo-user", "context": {"preferences": {"focusAreas": ["introduction", "intermediate"]}}}'

# Generar plan inteligente
curl -X POST http://localhost:3000/agents/plan/generate \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user", "preferences": {"maxTopics": 8, "daysPerWeek": 5, "hoursPerDay": 1.5, "preferredDifficulty": 2, "focusAreas": ["introduction", "intermediate"], "includeWeekends": false, "startDate": "2024-01-15"}}'

# Obtener siguiente acción
curl http://localhost:3000/agents/plan/next-action?userId=demo-user

# Revisar plan
curl http://localhost:3000/review/plan?userId=demo-user

# Enviar revisión de plan
curl -X POST http://localhost:3000/review/plan \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user", "planData": {"title": "Mi Plan Revisado", "topics": [{"topicId": "introduction", "targetDate": "2024-01-20", "estimatedMinutes": 45, "priority": "high", "approved": true}], "humanFeedback": "El plan se ve bien, pero necesito más tiempo para temas avanzados", "approved": true}}'

# Revisar quiz
curl http://localhost:3000/review/quiz?userId=demo-user&quizId=quiz-123

# Enviar revisión de quiz
curl -X POST http://localhost:3000/review/quiz \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user", "quizId": "quiz-123", "feedback": {"difficulty": "appropriate", "relevance": "high", "clarity": "good", "suggestions": "Consider adding more practical examples", "rating": 4}, "approved": true}}'

# Obtener revisiones pendientes
curl http://localhost:3000/review/pending?userId=demo-user

# Ejemplos de uso de API
# Crear quiz
curl -X POST http://localhost:3000/quiz \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user", "nQuestions": 3}'

# Responder pregunta
curl -X POST http://localhost:3000/quiz/QUIZ_ID/answer \
  -H "Content-Type: application/json" \
  -d '{"questionId": "QUESTION_ID", "selectedOption": "A"}'

# Ver progreso
curl "http://localhost:3000/progress?userId=demo-user"
\`\`\`

## 🔍 API Reference Completa

### Endpoints Principales

- **GET /** - Interfaz web completa
- **GET /api** - Información del API y health check
- **GET /search?q=...** - Búsqueda semántica
- **POST /chat** - Chat RAG con IA
- **GET /progress?userId=...** - Progreso del estudiante
- **POST /quiz** - Crear quiz adaptativo
- **POST /quiz/:id/answer** - Responder pregunta
- **GET /quiz/:id/results** - Resultados del quiz
- **POST /agents/execute** - Ejecutar agente individual
- **POST /agents/workflow** - Ejecutar workflow
- **POST /agents/plan/generate** - Generar plan inteligente
- **GET /agents/plan/next-action** - Obtener siguiente acción
- **GET /review/plan** - Obtener plan para revisión
- **POST /review/plan** - Enviar revisión de plan
- **GET /review/quiz** - Obtener quiz para revisión
- **POST /review/quiz** - Enviar revisión de quiz
- **GET /review/pending** - Obtener revisiones pendientes

### Códigos de Estado

- **200**: Operación exitosa
- **400**: Datos de entrada inválidos
- **404**: Recurso no encontrado
- **500**: Error interno del servidor

## ⚙️ Configuración de Groq

Para utilizar Groq como modelo de lenguaje, sigue estos pasos:

1.  **Obtén una API Key de Groq:** Regístrate en la plataforma de Groq y obtén tu API key.
2.  **Configura la variable de entorno:** Asegúrate de que la variable de entorno `GROQ_API_KEY` esté configurada en tu sistema.

## 🚨 Troubleshooting

### Error: "GROQ_API_KEY not found"
- Configura tu clave API: `echo "GROQ_API_KEY=tu_clave_aqui" > .env`
- Reinicia el servidor después de configurar

### Error: "No content found for topic"
- Ejecuta `npm run index` para generar embeddings
- Verifica que hay archivos .txt en `content/`
- Asegúrate de que el contenido sea relevante al tema

### Error: "Quiz not found"
- Verifica que el quizId sea correcto
- El quiz puede haber expirado o sido eliminado

### Preguntas de baja calidad
- Mejora la calidad del contenido en `content/`
- Asegúrate de que los textos sean informativos y bien estructurados
- Considera ajustar los parámetros de generación en `quizGenerator.js`

### Feedback irrelevante
- Verifica que GROQ_API_KEY esté configurada correctamente
- Revisa los logs del servidor para errores de IA
- Considera ajustar los prompts en `feedbackGenerator.js`

### Error: "Groq API Error"
- Verifica que tu clave API de Groq sea válida y esté configurada correctamente.
- Revisa los logs del servidor para obtener detalles específicos sobre el error de la API de Groq.
- Asegúrate de que tu cuenta de Groq tenga los permisos necesarios y no haya excedido los límites de uso.

## 🔮 Próximas Etapas

Este proyecto está diseñado para ser extensible:

- **✅ Etapa 1**: Chunking y búsqueda semántica
- **✅ Etapa 2**: Chat RAG con interfaz web
- **✅ Etapa 3**: Sistema BKT (Bayesian Knowledge Tracing)
- **✅ Etapa 4**: Quizzes adaptativos y feedback personalizado
- **Etapa 5**: Dashboard de analytics y métricas avanzadas
- **Etapa 6**: Integración con bases de datos vectoriales
- **Etapa 7**: Gamificación y sistema de logros
- **Etapa 8**: Colaboración y aprendizaje social

## 📊 Métricas y Analytics

El sistema rastrea automáticamente:

- **Progreso por tema**: Probabilidades BKT actualizadas
- **Rendimiento en quizzes**: Precisión y mejora temporal
- **Patrones de aprendizaje**: Temas más difíciles y fortalezas
- **Engagement**: Frecuencia de uso y tiempo de estudio

## 🎮 Características Avanzadas

### Adaptación Inteligente
- Selección automática de temas óptimos
- Ajuste de dificultad en tiempo real
- Recomendaciones personalizadas

### Feedback Contextual
- Explicaciones específicas por pregunta
- Sugerencias de estudio personalizadas
- Mensajes motivacionales adaptativos

### Persistencia Robusta
- Guardado automático de progreso
- Recuperación de sesiones interrumpidas
- Historial completo de interacciones

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

---

**Mora + DeerFlow** - Sistema completo de aprendizaje adaptativo con IA
