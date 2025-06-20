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

// window.confirmのモック
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn().mockReturnValue(true), // デフォルトでtrueを返す
});

// window.alertのモック
Object.defineProperty(window, 'alert', {
  writable: true,
  value: jest.fn(),
});

// window.promptのモック
Object.defineProperty(window, 'prompt', {
  writable: true,
  value: jest.fn().mockReturnValue('test'),
});

// URL.createObjectURLのモック
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: jest.fn().mockReturnValue('blob:test'),
});

// URL.revokeObjectURLのモック
Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
});

// FileReaderのモック
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  readAsArrayBuffer: jest.fn(),
  onload: null,
  onerror: null,
  result: null,
}));

// Blobのモック
global.Blob = jest.fn().mockImplementation((content, options) => ({
  size: content ? content.length : 0,
  type: options ? options.type : '',
  text: jest.fn().mockResolvedValue(content ? content.join('') : ''),
}));

// FormDataのモック
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  set: jest.fn(),
  entries: jest.fn(),
  keys: jest.fn(),
  values: jest.fn(),
}));

// タイマーのモック
jest.useFakeTimers(); 