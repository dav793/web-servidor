/**
 * Logging levels
 *      error:      0
 *      warn:       1
 *      info:       2
 *      verbose:    3
 *      debug:      4
 *      silly:      5
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const logDir = __dirname + '/../log';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const debugConsoleTransport = new transports.Console({
    level: 'debug',
    format: format.combine(
        format.colorize(),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(
            // info => `${info.timestamp} ${info.level}: ${typeof info.message === 'string' || typeof info.message === 'number' ? info.message : JSON.stringify(info.message)}`
            info => `${info.timestamp} ${info.level}: ${info.message}`
        )
    )
});

const combinedFileTransport = new transports.File({
    level: 'debug',
    filename: `${logDir}/out.log`,
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.json()
    ),
    handleExceptions: false
});

const logger = createLogger({
    transports: [
        debugConsoleTransport,
        combinedFileTransport
    ],
    exitOnError: true
});

// create a stream object with a 'write' function that will be used by morgan
logger.stream = {
    write: function(message, encoding) {
        logger.info(message.trim());
    }
};

module.exports = logger;
