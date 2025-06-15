import winston from "winston"
import config from "../config/index.js"

const loggingConfig = config.getLoggingConfig()

/**
 * Winston Logger Configuration with centralized config
 */
const logger = winston.createLogger({
  level: loggingConfig.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: "mora-deerflow",
    environment: config.env,
    version: "7.0.0-local",
  },
  transports: [
    // File transport
    new winston.transports.File({
      filename: loggingConfig.filePath,
      maxsize: loggingConfig.maxSize,
      maxFiles: loggingConfig.maxFiles,
      tailable: true,
    }),
  ],
})

// Add console transport if enabled
if (loggingConfig.enableConsole) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  )
}
