const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LogManager {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.logFile = null;
        this.setupLogFile();
    }

    async setupLogFile() {
        try {
            const settings = await this.settingsManager.loadSettings();
            const logDir = settings.logFilePath || this.getDefaultLogPath();
            
            // ログディレクトリが存在しない場合は作成
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // ログファイルパスを設定
            const today = new Date().toISOString().split('T')[0];
            this.logFile = path.join(logDir, `image-cleaner-${today}.log`);
            
            // ログファイルが存在しない場合は作成
            if (!fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, '');
            }
            
            console.log('Log manager initialized. Log file:', this.logFile);
        } catch (error) {
            console.error('Failed to setup log file:', error);
        }
    }

    getDefaultLogPath() {
        return path.join(app.getPath('userData'), 'logs');
    }

    async log(level, category, message, data = null) {
        try {
            const settings = await this.settingsManager.loadSettings();
            const currentLogLevel = settings.logLevel || 'normal';
            
            // ログレベルチェック
            if (!this.shouldLog(level, currentLogLevel)) {
                return;
            }
            
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                category,
                message,
                data
            };
            
            const logLine = JSON.stringify(logEntry) + '\n';
            
            // ファイルに書き込み
            if (this.logFile) {
                try {
                    fs.appendFileSync(this.logFile, logLine);
                } catch (fileError) {
                    console.error('Failed to write to log file:', fileError);
                }
            }
            
            // コンソールにも出力（開発時）
            if (!app.isPackaged) {
                const consoleMsg = `[${timestamp}] ${level.toUpperCase()} [${category}] ${message}`;
                if (data) {
                    console.log(consoleMsg, data);
                } else {
                    console.log(consoleMsg);
                }
            }
        } catch (error) {
            console.error('Failed to log message:', error);
        }
    }

    shouldLog(level, currentLogLevel) {
        const levels = {
            'error': 0,
            'normal': 1,
            'debug': 2
        };
        
        const levelPriority = {
            'error': 0,
            'info': 1,
            'debug': 2
        };
        
        return levelPriority[level] <= levels[currentLogLevel];
    }

    // 便利メソッド
    async error(category, message, data = null) {
        await this.log('error', category, message, data);
    }

    async info(category, message, data = null) {
        await this.log('info', category, message, data);
    }

    async debug(category, message, data = null) {
        await this.log('debug', category, message, data);
    }

    // ログファイルの内容を取得
    async getLogContents(days = 7) {
        try {
            const settings = await this.settingsManager.loadSettings();
            const logDir = settings.logFilePath || this.getDefaultLogPath();
            
            if (!fs.existsSync(logDir)) {
                return [];
            }
            
            const logs = [];
            const now = new Date();
            
            for (let i = 0; i < days; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const logFile = path.join(logDir, `image-cleaner-${dateStr}.log`);
                
                if (fs.existsSync(logFile)) {
                    const content = fs.readFileSync(logFile, 'utf8');
                    const lines = content.trim().split('\n').filter(line => line.length > 0);
                    
                    for (const line of lines) {
                        try {
                            const logEntry = JSON.parse(line);
                            logs.push(logEntry);
                        } catch (parseError) {
                            // 無効なJSON行をスキップ
                        }
                    }
                }
            }
            
            // タイムスタンプでソート（新しい順）
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return logs;
            
        } catch (error) {
            console.error('Failed to get log contents:', error);
            return [];
        }
    }

    // エラーログのみを取得
    async getErrorLogs(days = 7) {
        const allLogs = await this.getLogContents(days);
        return allLogs.filter(log => log.level === 'error');
    }
}

module.exports = LogManager;