// Jest setup file
global.console = {
  ...console,
  // テスト中のコンソール出力を抑制
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// グローバル変数のモック
global.currentResults = {};
global.currentTab = 'blur';

// Electron APIのモック
global.window = {
  electronAPI: {
    loadSettings: jest.fn(),
    saveSettings: jest.fn(),
    selectFolder: jest.fn(),
    writeFile: jest.fn(),
    writeToLog: jest.fn()
  }
};

// DOM要素のモック
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
}); 